-- Diagnostic query: Find timesheet entries with invalid durations
-- (clock_out is before or equal to clock_in)

SELECT 
  id,
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_date,
  clock_out_time,
  (clock_in_date + clock_in_time) as clock_in_timestamp,
  (clock_out_date + clock_out_time) as clock_out_timestamp,
  total_hours,
  CASE 
    WHEN clock_out_date IS NULL OR clock_out_time IS NULL THEN 'Missing clock-out'
    WHEN (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time) THEN 'Invalid: clock-out <= clock-in'
    ELSE 'Valid'
  END as validation_status
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time)
ORDER BY clock_in_date DESC, clock_in_time DESC;

