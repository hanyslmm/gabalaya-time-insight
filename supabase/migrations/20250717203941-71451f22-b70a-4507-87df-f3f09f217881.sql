-- Fix unclosed clock-in records that are preventing new clock-ins
-- Update the unclosed entry for EMP085382 (Donia Amal) from July 16th

UPDATE timesheet_entries 
SET 
    clock_out_time = '22:06:00',
    clock_out_date = clock_in_date,
    clock_out_location = clock_in_location,
    total_hours = 0
WHERE 
    employee_name = 'Donia Amal' 
    AND clock_in_date = '2025-07-16' 
    AND clock_out_time IS NULL;