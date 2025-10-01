-- Test direct update to see if the issue is in the database or application

-- First, check the current value
SELECT 
    id,
    employee_name,
    clock_in_date,
    clock_in_time,
    clock_out_date,
    clock_out_time,
    total_hours,
    morning_hours,
    night_hours
FROM timesheet_entries
WHERE employee_name = 'hend'
  AND clock_in_date = '2025-09-26'
ORDER BY clock_in_date DESC
LIMIT 1;

-- Now let's try updating it directly in SQL
-- UPDATE timesheet_entries
-- SET 
--     clock_in_time = '10:45:00',
--     clock_out_time = '16:15:00',
--     total_hours = 5.5,
--     morning_hours = 5.5,
--     night_hours = 0
-- WHERE employee_name = 'hend'
--   AND clock_in_date = '2025-09-26';

-- Then check again to see if it persists
-- SELECT 
--     clock_in_time,
--     clock_out_time,
--     total_hours,
--     morning_hours,
--     night_hours
-- FROM timesheet_entries
-- WHERE employee_name = 'hend'
--   AND clock_in_date = '2025-09-26';

