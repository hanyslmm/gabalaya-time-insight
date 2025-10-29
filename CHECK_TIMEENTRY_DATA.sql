-- Check the actual time data for Maha Khalil on 29/10/2025
SELECT 
  id,
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_date,
  clock_out_time,
  total_hours,
  morning_hours,
  night_hours,
  -- Show the time parts
  EXTRACT(HOUR FROM clock_in_time) as clock_in_hour,
  EXTRACT(MINUTE FROM clock_in_time) as clock_in_minute,
  EXTRACT(HOUR FROM clock_out_time) as clock_out_hour,
  EXTRACT(MINUTE FROM clock_out_time) as clock_out_minute
FROM public.timesheet_entries
WHERE employee_name = 'Maha Khalil'
  AND clock_in_date = '2025-10-29'
ORDER BY clock_in_time DESC
LIMIT 5;

-- Also check what timezone the clock functions are using
SELECT get_company_timezone() as company_timezone;

-- Check current time conversions
SELECT 
  NOW() as utc_now,
  utc_to_company_time(NOW()) as cairo_now,
  CURRENT_TIME as pg_current_time,
  CURRENT_DATE as pg_current_date;

