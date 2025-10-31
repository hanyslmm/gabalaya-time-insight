-- Query to find timesheet entries where total_hours doesn't match morning_hours + night_hours
-- This will help identify data inconsistencies

SELECT 
    id,
    employee_name,
    clock_in_date,
    clock_in_time,
    clock_out_time,
    total_hours,
    morning_hours,
    night_hours,
    (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as calculated_total,
    (total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) as difference,
    ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) as abs_difference
FROM timesheet_entries 
WHERE 
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1
ORDER BY abs_difference DESC, employee_name, clock_in_date;

-- Summary of problematic records by employee
SELECT 
    employee_name,
    COUNT(*) as problematic_records,
    SUM(total_hours) as sum_total_hours,
    SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as sum_calculated_hours,
    SUM(total_hours) - SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as total_difference
FROM timesheet_entries 
WHERE 
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1
GROUP BY employee_name
ORDER BY total_difference DESC;

-- Specific check for Hala's records
SELECT 
    id,
    clock_in_date,
    clock_in_time,
    clock_out_time,
    total_hours,
    morning_hours,
    night_hours,
    (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as calculated_total,
    (total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) as difference
FROM timesheet_entries 
WHERE 
    employee_name ILIKE '%hala%'
    AND total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
ORDER BY clock_in_date DESC;