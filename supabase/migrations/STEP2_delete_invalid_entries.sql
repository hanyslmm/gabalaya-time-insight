-- STEP 2: DELETE ANY REMAINING INVALID ENTRIES
-- Run this SECOND to remove entries that are still invalid

-- Show what will be deleted
SELECT 
  id, employee_name,
  clock_in_date, clock_in_time,
  clock_out_date, clock_out_time,
  total_hours,
  'Will be deleted - invalid entry' as action
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- Delete them
DELETE FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- Verify all invalid entries are gone
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ All invalid entries cleaned up!'
    ELSE '❌ Still have ' || COUNT(*) || ' invalid entries'
  END as status
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);
