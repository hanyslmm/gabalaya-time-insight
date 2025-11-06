-- STEP 3: REMOVE OVERLAPPING ENTRIES
-- Run this THIRD to clean up overlaps (keeps longer duration)

-- Find and delete overlapping entries
DO $$
DECLARE
  overlap_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Find all overlapping pairs
  FOR overlap_record IN
    SELECT 
      t1.id as id1,
      t1.total_hours as hours1,
      t2.id as id2,
      t2.total_hours as hours2,
      t1.employee_name,
      (t1.clock_in_date + t1.clock_in_time) as start1,
      (t1.clock_out_date + t1.clock_out_time) as end1,
      (t2.clock_in_date + t2.clock_in_time) as start2,
      (t2.clock_out_date + t2.clock_out_time) as end2
    FROM public.timesheet_entries t1
    CROSS JOIN public.timesheet_entries t2
    WHERE 
      t1.employee_id = t2.employee_id
      AND t1.id != t2.id
      AND t1.clock_out_date IS NOT NULL
      AND t2.clock_out_date IS NOT NULL
  LOOP
    -- Only process if both entries are valid
    IF overlap_record.start1 < overlap_record.end1 AND 
       overlap_record.start2 < overlap_record.end2 THEN
      
      -- Check if they overlap
      IF overlap_record.start1 < overlap_record.end2 AND 
         overlap_record.start2 < overlap_record.end1 THEN
        
        -- Delete the shorter one
        IF overlap_record.hours1 < overlap_record.hours2 THEN
          DELETE FROM public.timesheet_entries WHERE id = overlap_record.id1;
          deleted_count := deleted_count + 1;
          RAISE NOTICE 'Deleted entry for % (%.2f hours)', 
            overlap_record.employee_name, overlap_record.hours1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total overlapping entries deleted: %', deleted_count;
END $$;

-- Show remaining data
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT employee_id) as employees
FROM public.timesheet_entries;
