-- Fix hour inconsistencies in timesheet_entries
-- This script addresses cases where total_hours doesn't match morning_hours + night_hours
-- The issue occurs when clock_out function calculates total_hours from actual time worked
-- but morning/night hours only account for time within defined wage periods

-- First, let's see the current state of problematic records
SELECT 
    'BEFORE FIX - Problematic Records' as status,
    COUNT(*) as count,
    SUM(total_hours) as sum_total_hours,
    SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as sum_calculated_hours,
    SUM(total_hours) - SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as total_difference
FROM timesheet_entries 
WHERE 
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1;

-- Show specific examples of problematic records
SELECT 
    employee_name,
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
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1
ORDER BY ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) DESC
LIMIT 10;

-- OPTION 1: Update total_hours to match morning_hours + night_hours
-- This ensures consistency with wage calculations
-- Uncomment the following block to apply this fix:

/*
UPDATE timesheet_entries 
SET total_hours = COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)
WHERE 
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1;
*/

-- OPTION 2: Recalculate morning/night hours based on total_hours
-- This preserves the actual time worked but redistributes it
-- Uncomment the following block to apply this alternative fix:

/*
-- Create a function to recalculate morning/night split based on shift times
CREATE OR REPLACE FUNCTION recalculate_hour_split(
    p_clock_in_time TIME,
    p_clock_out_time TIME,
    p_total_hours NUMERIC
) RETURNS TABLE(morning_hours NUMERIC, night_hours NUMERIC) AS $$
DECLARE
    v_start_minutes INTEGER;
    v_end_minutes INTEGER;
    v_morning_start INTEGER := 360; -- 6 AM in minutes
    v_morning_end INTEGER := 1020; -- 5 PM in minutes
    v_morning_minutes INTEGER := 0;
    v_night_minutes INTEGER := 0;
    v_total_minutes INTEGER;
    v_scale_factor NUMERIC;
BEGIN
    -- Convert times to minutes
    v_start_minutes := EXTRACT(HOUR FROM p_clock_in_time) * 60 + EXTRACT(MINUTE FROM p_clock_in_time);
    v_end_minutes := EXTRACT(HOUR FROM p_clock_out_time) * 60 + EXTRACT(MINUTE FROM p_clock_out_time);
    
    -- Handle overnight shifts
    IF v_end_minutes < v_start_minutes THEN
        v_end_minutes := v_end_minutes + (24 * 60);
    END IF;
    
    v_total_minutes := v_end_minutes - v_start_minutes;
    
    -- Calculate morning overlap (6 AM - 5 PM)
    v_morning_minutes := GREATEST(0, LEAST(v_end_minutes, v_morning_end) - GREATEST(v_start_minutes, v_morning_start));
    
    -- Night is the rest
    v_night_minutes := v_total_minutes - v_morning_minutes;
    
    -- Scale to match actual total_hours (in case of breaks or other factors)
    IF v_total_minutes > 0 THEN
        v_scale_factor := (p_total_hours * 60) / v_total_minutes;
        v_morning_minutes := v_morning_minutes * v_scale_factor;
        v_night_minutes := v_night_minutes * v_scale_factor;
    END IF;
    
    RETURN QUERY SELECT 
        ROUND(v_morning_minutes / 60.0, 2) AS morning_hours,
        ROUND(v_night_minutes / 60.0, 2) AS night_hours;
END;
$$ LANGUAGE plpgsql;

-- Apply the recalculation
UPDATE timesheet_entries 
SET 
    morning_hours = split.morning_hours,
    night_hours = split.night_hours
FROM (
    SELECT 
        id,
        (recalculate_hour_split(clock_in_time, clock_out_time, total_hours)).morning_hours,
        (recalculate_hour_split(clock_in_time, clock_out_time, total_hours)).night_hours
    FROM timesheet_entries 
    WHERE 
        total_hours IS NOT NULL 
        AND clock_in_time IS NOT NULL 
        AND clock_out_time IS NOT NULL
        AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
        AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1
) split
WHERE timesheet_entries.id = split.id;

-- Clean up the temporary function
DROP FUNCTION recalculate_hour_split(TIME, TIME, NUMERIC);
*/

-- Verify the fix (run after applying either option)
SELECT 
    'AFTER FIX - Remaining Problematic Records' as status,
    COUNT(*) as count,
    SUM(total_hours) as sum_total_hours,
    SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as sum_calculated_hours,
    SUM(total_hours) - SUM(COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as total_difference
FROM timesheet_entries 
WHERE 
    total_hours IS NOT NULL 
    AND (morning_hours IS NOT NULL OR night_hours IS NOT NULL)
    AND ABS(total_hours - (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0))) > 0.1;

-- Show Hala's records after fix
SELECT 
    'Hala Records After Fix' as status,
    clock_in_date,
    total_hours,
    morning_hours,
    night_hours,
    (COALESCE(morning_hours, 0) + COALESCE(night_hours, 0)) as calculated_total
FROM timesheet_entries 
WHERE employee_name ILIKE '%hala%'
ORDER BY clock_in_date DESC
LIMIT 10;