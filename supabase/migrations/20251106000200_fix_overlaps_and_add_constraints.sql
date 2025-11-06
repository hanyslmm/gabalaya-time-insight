-- FIX EXISTING OVERLAPPING TIMESHEETS AND ADD PREVENTION CONSTRAINTS
-- This migration does three things:
-- 1. Fixes overnight shifts (where clock_out is on the same day but earlier time)
-- 2. Cleans up existing overlapping entries (keeps longer duration)
-- 3. Adds database constraints to prevent future overlaps

-- ============================================================================
-- STEP 0: FIX OVERNIGHT SHIFTS FIRST
-- ============================================================================

-- Show overnight shifts that will be fixed
SELECT 
  id, employee_name,
  clock_in_date,
  to_char(clock_in_time, 'HH24:MI') as clock_in_time,
  clock_out_date,
  to_char(clock_out_time, 'HH24:MI') as clock_out_time,
  total_hours,
  'Overnight shift - will add 1 day to clock_out_date' as action
FROM public.timesheet_entries
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND total_hours BETWEEN 4 AND 14
  AND clock_out_date IS NOT NULL
ORDER BY clock_in_date DESC;

-- Fix overnight shifts by adding 1 day to clock_out_date
UPDATE public.timesheet_entries
SET clock_out_date = clock_out_date + INTERVAL '1 day'
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND total_hours BETWEEN 4 AND 14
  AND clock_out_date IS NOT NULL;

-- ============================================================================
-- STEP 1: IDENTIFY OVERLAPPING ENTRIES
-- ============================================================================

-- Show all overlapping entries before cleanup
SELECT 
  t1.employee_name,
  t1.clock_in_date as date1_in,
  to_char(t1.clock_in_time, 'HH24:MI') as time1_in,
  to_char(t1.clock_out_time, 'HH24:MI') as time1_out,
  t1.total_hours as hours1,
  t2.clock_in_date as date2_in,
  to_char(t2.clock_in_time, 'HH24:MI') as time2_in,
  to_char(t2.clock_out_time, 'HH24:MI') as time2_out,
  t2.total_hours as hours2,
  CASE 
    WHEN t1.total_hours < t2.total_hours THEN 'Will delete entry 1 (shorter)'
    WHEN t2.total_hours < t1.total_hours THEN 'Will delete entry 2 (shorter)'
    ELSE 'Equal duration - will delete newer'
  END as action
FROM public.timesheet_entries t1
JOIN public.timesheet_entries t2 ON 
  t1.employee_id = t2.employee_id 
  AND t1.id < t2.id
WHERE
  t1.clock_out_date IS NOT NULL AND t1.clock_out_time IS NOT NULL
  AND t2.clock_out_date IS NOT NULL AND t2.clock_out_time IS NOT NULL
  -- Ensure valid durations before checking overlap
  AND (t1.clock_in_date + t1.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
  AND (t2.clock_in_date + t2.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
  AND (
    -- Check for overlap: start1 < end2 AND start2 < end1
    (t1.clock_in_date + t1.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
    AND (t2.clock_in_date + t2.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
  )
ORDER BY t1.employee_name, t1.clock_in_date;

-- ============================================================================
-- STEP 2: DELETE OVERLAPPING ENTRIES (KEEP LONGER DURATION)
-- ============================================================================

DO $$
DECLARE
  overlap_record RECORD;
  deleted_count INTEGER := 0;
  id_to_delete UUID;
  start1 TIMESTAMP;
  end1 TIMESTAMP;
  start2 TIMESTAMP;
  end2 TIMESTAMP;
BEGIN
  RAISE NOTICE 'Starting overlap cleanup...';
  
  -- Find all overlapping pairs
  FOR overlap_record IN
    SELECT 
      t1.id as id1,
      t1.total_hours as hours1,
      t1.created_at as created1,
      t2.id as id2,
      t2.total_hours as hours2,
      t2.created_at as created2,
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
      AND t1.id < t2.id
    WHERE
      t1.clock_out_date IS NOT NULL AND t1.clock_out_time IS NOT NULL
      AND t2.clock_out_date IS NOT NULL AND t2.clock_out_time IS NOT NULL
      -- Only process entries with valid durations
      AND (t1.clock_in_date + t1.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
      AND (t2.clock_in_date + t2.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
  LOOP
    -- Calculate full timestamps
    start1 := overlap_record.date1_in + overlap_record.time1_in;
    end1 := overlap_record.date1_out + overlap_record.time1_out;
    start2 := overlap_record.date2_in + overlap_record.time2_in;
    end2 := overlap_record.date2_out + overlap_record.time2_out;
    
    -- Skip if either entry has invalid duration
    IF start1 >= end1 OR start2 >= end2 THEN
      CONTINUE;
    END IF;
    
    -- Check if they overlap: start1 < end2 AND start2 < end1
    IF start1 < end2 AND start2 < end1 THEN
      -- Determine which to delete based on duration
      IF overlap_record.hours1 < overlap_record.hours2 THEN
        id_to_delete := overlap_record.id1;
        RAISE NOTICE '  Deleting entry for % (%.2fh) - keeping longer entry (%.2fh)',
          overlap_record.employee_name,
          overlap_record.hours1,
          overlap_record.hours2;
      ELSIF overlap_record.hours2 < overlap_record.hours1 THEN
        id_to_delete := overlap_record.id2;
        RAISE NOTICE '  Deleting entry for % (%.2fh) - keeping longer entry (%.2fh)',
          overlap_record.employee_name,
          overlap_record.hours2,
          overlap_record.hours1;
      ELSE
        -- Equal duration: delete the newer one
        IF overlap_record.created1 > overlap_record.created2 THEN
          id_to_delete := overlap_record.id1;
        ELSE
          id_to_delete := overlap_record.id2;
        END IF;
        RAISE NOTICE '  Equal durations for % - deleting newer entry',
          overlap_record.employee_name;
      END IF;
      
      DELETE FROM public.timesheet_entries WHERE id = id_to_delete;
      deleted_count := deleted_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Cleanup complete: Deleted % overlapping entries', deleted_count;
END $$;

-- ============================================================================
-- STEP 3: ADD DATABASE CONSTRAINTS
-- ============================================================================

-- Enable required extension for overlap detection
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop constraints if they exist (for re-running)
ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_no_overlap_excl;

-- Add exclusion constraint to prevent overlapping timesheets
ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_no_overlap_excl
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      (clock_in_date + clock_in_time),
      COALESCE((clock_out_date + clock_out_time), 'infinity'::timestamp),
      '[]'
    ) WITH &&
  );

COMMENT ON CONSTRAINT timesheet_no_overlap_excl ON public.timesheet_entries
IS 'Prevents overlapping timesheet intervals for the same employee. Keeps longer duration when overlaps are detected.';

-- ============================================================================
-- STEP 4: VERIFY SUCCESS
-- ============================================================================

-- Check for any remaining overlaps
DO $$
DECLARE
  overlap_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO overlap_count
  FROM public.timesheet_entries t1
  JOIN public.timesheet_entries t2 ON 
    t1.employee_id = t2.employee_id 
    AND t1.id < t2.id
  WHERE
    t1.clock_out_date IS NOT NULL AND t1.clock_out_time IS NOT NULL
    AND t2.clock_out_date IS NOT NULL AND t2.clock_out_time IS NOT NULL
    -- Only check valid entries
    AND (t1.clock_in_date + t1.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
    AND (t2.clock_in_date + t2.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
    AND (
      (t1.clock_in_date + t1.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
      AND (t2.clock_in_date + t2.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
    );
  
  IF overlap_count > 0 THEN
    RAISE WARNING '⚠ Warning: % overlapping pairs still exist', overlap_count;
  ELSE
    RAISE NOTICE '✓ Success: No overlapping entries found!';
    RAISE NOTICE '✓ Database constraint added to prevent future overlaps';
  END IF;
END $$;

-- Show final summary
SELECT 
  'Migration Complete' as status,
  COUNT(*) as total_entries,
  COUNT(DISTINCT employee_id) as unique_employees,
  MIN(clock_in_date) as earliest_date,
  MAX(clock_in_date) as latest_date
FROM public.timesheet_entries;
