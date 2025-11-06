-- Prevent overlapping timesheet entries per employee
-- IMPORTANT: Run 20251106000097_cleanup_test_data.sql FIRST to remove old test data
-- Requires GiST operator classes for equality on scalar types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- STEP 1: First, let's see what invalid entries exist
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.timesheet_entries
  WHERE 
    clock_out_date IS NOT NULL 
    AND clock_out_time IS NOT NULL
    AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);
  
  RAISE NOTICE 'Found % entries with invalid durations (clock_out <= clock_in)', invalid_count;
END $$;

-- STEP 2: Delete entries with invalid durations (clock_out <= clock_in)
-- These are data quality issues that need to be removed
DELETE FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- STEP 3: Handle existing overlaps before applying exclusion constraint
-- Rule: When overlaps exist, DELETE the entry with SMALLER total_hours (keep the longer one)
DO $$
DECLARE
  overlap_record RECORD;
  deleted_count INTEGER := 0;
  id_to_delete UUID;
  start1 timestamp;
  end1 timestamp;
  start2 timestamp;
  end2 timestamp;
BEGIN
  -- Find overlapping entries and determine which to delete based on total_hours
  FOR overlap_record IN
    SELECT 
      t1.id as id1,
      t1.total_hours as hours1,
      t2.id as id2,
      t2.total_hours as hours2,
      t1.employee_id,
      t1.employee_name,
      t1.clock_in_date as date1_in,
      t1.clock_in_time as time1_in,
      t1.clock_out_date as date1_out,
      t1.clock_out_time as time1_out,
      t2.clock_in_date as date2_in,
      t2.clock_in_time as time2_in,
      t2.clock_out_date as date2_out,
      t2.clock_out_time as time2_out
    FROM public.timesheet_entries t1
    JOIN public.timesheet_entries t2 ON 
      t1.employee_id = t2.employee_id 
      AND t1.id != t2.id -- Compare all pairs
    WHERE
      -- Ensure both entries have valid clock-out times
      t1.clock_out_date IS NOT NULL AND t1.clock_out_time IS NOT NULL
      AND t2.clock_out_date IS NOT NULL AND t2.clock_out_time IS NOT NULL
      -- Only process each pair once
      AND t1.id < t2.id
  LOOP
    -- Calculate timestamps for comparison
    start1 := overlap_record.date1_in + overlap_record.time1_in;
    end1 := overlap_record.date1_out + overlap_record.time1_out;
    start2 := overlap_record.date2_in + overlap_record.time2_in;
    end2 := overlap_record.date2_out + overlap_record.time2_out;
    
    -- Skip if either entry has invalid duration
    IF start1 >= end1 OR start2 >= end2 THEN
      CONTINUE;
    END IF;
    
    -- Check if they overlap (manually, without tsrange)
    -- Two intervals overlap if: start1 < end2 AND start2 < end1
    IF start1 < end2 AND start2 < end1 THEN
      -- They overlap! Determine which entry to delete: the one with SMALLER total_hours
      IF overlap_record.hours1 < overlap_record.hours2 THEN
        id_to_delete := overlap_record.id1;
        RAISE NOTICE 'Found overlap for employee %: Deleting Entry % (%.2f hours) and keeping Entry % (%.2f hours)',
          overlap_record.employee_name,
          overlap_record.id1,
          overlap_record.hours1,
          overlap_record.id2,
          overlap_record.hours2;
      ELSIF overlap_record.hours1 > overlap_record.hours2 THEN
        id_to_delete := overlap_record.id2;
        RAISE NOTICE 'Found overlap for employee %: Deleting Entry % (%.2f hours) and keeping Entry % (%.2f hours)',
          overlap_record.employee_name,
          overlap_record.id2,
          overlap_record.hours2,
          overlap_record.id1,
          overlap_record.hours1;
      ELSE
        -- Equal hours, delete the newer one (higher ID)
        id_to_delete := overlap_record.id2;
        RAISE NOTICE 'Found overlap for employee % with equal hours (%.2f): Deleting newer Entry %',
          overlap_record.employee_name,
          overlap_record.hours1,
          overlap_record.id2;
      END IF;
      
      -- Delete the entry with smaller duration
      DELETE FROM public.timesheet_entries WHERE id = id_to_delete;
      deleted_count := deleted_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % overlapping timesheet entries (deleted shorter durations)', deleted_count;
END $$;

-- STEP 4: Drop existing constraints if they exist (to allow re-running)
ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_positive_duration_chk;

ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_no_overlap_excl;

ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_reasonable_date_chk;

-- STEP 5: Now apply the positive duration check constraint
ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_positive_duration_chk
  CHECK (
    clock_out_date IS NULL
    OR clock_out_time IS NULL
    OR (clock_in_date + clock_in_time) < (clock_out_date + clock_out_time)
  );

-- STEP 5.1: Add reasonable date range constraint (prevent far future dates)
-- Allow up to 7 days in the future for flexibility
ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_reasonable_date_chk
  CHECK (
    clock_in_date <= CURRENT_DATE + INTERVAL '7 days'
  );

-- STEP 6: Now apply the exclusion constraint to prevent future overlaps
ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_no_overlap_excl
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      (clock_in_date + clock_in_time),
      COALESCE((clock_out_date + clock_out_time), 'infinity'::timestamp),
      '[)'
    ) WITH &&
  );

COMMENT ON CONSTRAINT timesheet_no_overlap_excl ON public.timesheet_entries
IS 'Prevents overlapping timesheet intervals for the same employee (half-open [) bounds allow adjacent entries).';