-- STEP 1: FIX OVERNIGHT SHIFTS
-- Run this FIRST to fix entries where clock_out appears before clock_in

-- Show what will be fixed
SELECT 
  id, employee_name,
  clock_in_date, clock_in_time,
  clock_out_date, clock_out_time,
  total_hours
FROM public.timesheet_entries
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND clock_out_date IS NOT NULL;

-- Fix them by adding 1 day to clock_out_date
UPDATE public.timesheet_entries
SET clock_out_date = clock_out_date + INTERVAL '1 day'
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND clock_out_date IS NOT NULL;

-- Verify the fix
SELECT COUNT(*) as remaining_invalid
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);
