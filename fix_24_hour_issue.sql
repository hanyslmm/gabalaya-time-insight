-- Fix the 24-hour timesheet record issue for 19/10/2025 2:30 PM - 8:06 PM
-- This entry should be ~5.6 hours, not 24 hours

-- First, let's identify the problematic record
SELECT 
    id,
    employee_name,
    clock_in_date,
    clock_in_time,
    clock_out_time,
    total_hours,
    morning_hours,
    night_hours,
    EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0 as calculated_hours
FROM timesheet_entries 
WHERE 
    clock_in_date = '2025-10-19'
    AND clock_in_time::text LIKE '14:30%' -- 2:30 PM
    AND clock_out_time::text LIKE '20:06%' -- 8:06 PM
    AND total_hours = 24;

-- Show what the correct calculation should be
SELECT 
    '2:30 PM to 8:06 PM should be:' as description,
    EXTRACT(EPOCH FROM ('20:06:00'::time - '14:30:00'::time)) / 3600.0 as correct_hours;

-- Fix the specific record
UPDATE timesheet_entries 
SET 
    total_hours = EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0,
    morning_hours = CASE 
        -- 2:30 PM to 5:00 PM = 2.5 hours morning
        WHEN clock_in_time >= '14:30:00' AND clock_out_time <= '17:00:00' THEN 
            EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0
        -- 2:30 PM to 8:06 PM: morning portion is 2:30 PM to 5:00 PM = 2.5 hours
        WHEN clock_in_time >= '14:30:00' AND clock_out_time > '17:00:00' THEN 
            EXTRACT(EPOCH FROM ('17:00:00'::time - clock_in_time)) / 3600.0
        ELSE 0
    END,
    night_hours = CASE 
        -- Night portion is 5:00 PM to 8:06 PM = 3.1 hours
        WHEN clock_in_time < '17:00:00' AND clock_out_time > '17:00:00' THEN 
            EXTRACT(EPOCH FROM (clock_out_time - '17:00:00'::time)) / 3600.0
        -- If entirely in night period
        WHEN clock_in_time >= '17:00:00' THEN 
            EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0
        ELSE 0
    END
WHERE 
    clock_in_date = '2025-10-19'
    AND clock_in_time::text LIKE '14:30%'
    AND clock_out_time::text LIKE '20:06%'
    AND total_hours = 24;

-- Verify the fix
SELECT 
    'After fix:' as status,
    id,
    employee_name,
    clock_in_date,
    clock_in_time,
    clock_out_time,
    total_hours,
    morning_hours,
    night_hours,
    (morning_hours + night_hours) as calculated_total
FROM timesheet_entries 
WHERE 
    clock_in_date = '2025-10-19'
    AND clock_in_time::text LIKE '14:30%'
    AND clock_out_time::text LIKE '20:06%';

-- Also check for any other similar issues (entries with unrealistic total_hours)
SELECT 
    'Other potential issues:' as status,
    id,
    employee_name,
    clock_in_date,
    clock_in_time,
    clock_out_time,
    total_hours,
    EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0 as calculated_hours,
    ABS(total_hours - EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0) as difference
FROM timesheet_entries 
WHERE 
    clock_in_time IS NOT NULL 
    AND clock_out_time IS NOT NULL
    AND total_hours > 0
    AND ABS(total_hours - EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0) > 1.0
ORDER BY difference DESC
LIMIT 10;