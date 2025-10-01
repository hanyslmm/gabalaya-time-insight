-- Fix all existing timesheet entries to use 6 AM - 5 PM morning, 5 PM - 6 AM night
-- This is a permanent fix for all existing and future records

-- Create or replace function to calculate morning and night hours
CREATE OR REPLACE FUNCTION calculate_split_hours(
  p_clock_in_time TIME,
  p_clock_out_time TIME
) RETURNS TABLE(morning_hours NUMERIC, night_hours NUMERIC) AS $$
DECLARE
  v_start_minutes INTEGER;
  v_end_minutes INTEGER;
  v_morning_start INTEGER := 360; -- 6 AM in minutes
  v_morning_end INTEGER := 1020; -- 5 PM in minutes
  v_morning_minutes INTEGER := 0;
  v_night_minutes INTEGER := 0;
BEGIN
  -- Convert times to minutes
  v_start_minutes := EXTRACT(HOUR FROM p_clock_in_time) * 60 + EXTRACT(MINUTE FROM p_clock_in_time);
  v_end_minutes := EXTRACT(HOUR FROM p_clock_out_time) * 60 + EXTRACT(MINUTE FROM p_clock_out_time);
  
  -- Handle overnight shifts
  IF v_end_minutes <= v_start_minutes THEN
    v_end_minutes := v_end_minutes + 1440; -- Add 24 hours
  END IF;
  
  -- Calculate morning overlap (6 AM to 5 PM)
  v_morning_minutes := GREATEST(0, 
    LEAST(v_end_minutes, v_morning_end) - GREATEST(v_start_minutes, v_morning_start)
  );
  
  -- Calculate total minutes worked
  -- Night minutes = total - morning
  v_night_minutes := (v_end_minutes - v_start_minutes) - v_morning_minutes;
  
  -- Return hours rounded to 2 decimal places
  RETURN QUERY SELECT 
    ROUND(v_morning_minutes::NUMERIC / 60, 2) AS morning_hours,
    ROUND(v_night_minutes::NUMERIC / 60, 2) AS night_hours;
END;
$$ LANGUAGE plpgsql;

-- Update all existing timesheet entries
UPDATE timesheet_entries te
SET 
  morning_hours = COALESCE(split.morning_hours, 0),
  night_hours = COALESCE(split.night_hours, 0),
  is_split_calculation = true
FROM (
  SELECT 
    id,
    (calculate_split_hours(clock_in_time::TIME, clock_out_time::TIME)).*
  FROM timesheet_entries
  WHERE clock_in_time IS NOT NULL 
    AND clock_out_time IS NOT NULL
) split
WHERE te.id = split.id;

-- Create trigger to automatically calculate split hours for new entries
CREATE OR REPLACE FUNCTION auto_calculate_split_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_in_time IS NOT NULL AND NEW.clock_out_time IS NOT NULL THEN
    SELECT morning_hours, night_hours 
    INTO NEW.morning_hours, NEW.night_hours
    FROM calculate_split_hours(NEW.clock_in_time::TIME, NEW.clock_out_time::TIME);
    
    NEW.is_split_calculation := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_split_hours_trigger ON timesheet_entries;

-- Create trigger for new inserts and updates
CREATE TRIGGER auto_split_hours_trigger
BEFORE INSERT OR UPDATE OF clock_in_time, clock_out_time ON timesheet_entries
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_split_hours();

-- Verify the fix
DO $$
DECLARE
  v_total_hours NUMERIC;
  v_morning_hours NUMERIC;
  v_night_hours NUMERIC;
  v_unassigned NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(total_hours), 0),
    COALESCE(SUM(morning_hours), 0),
    COALESCE(SUM(night_hours), 0),
    COALESCE(SUM(total_hours - (morning_hours + night_hours)), 0)
  INTO v_total_hours, v_morning_hours, v_night_hours, v_unassigned
  FROM timesheet_entries
  WHERE clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL;
  
  RAISE NOTICE 'Migration Complete:';
  RAISE NOTICE '  Total Hours: %', v_total_hours;
  RAISE NOTICE '  Morning Hours: %', v_morning_hours;
  RAISE NOTICE '  Night Hours: %', v_night_hours;
  RAISE NOTICE '  Unassigned Hours: %', v_unassigned;
END $$;
