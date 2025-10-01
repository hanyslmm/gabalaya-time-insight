-- Fix all morning/night hours for timesheet entries
-- This recalculates based on simple logic: 8 AM - 5 PM = morning, rest = night

-- Update all entries to recalculate morning/night hours
UPDATE timesheet_entries
SET 
  morning_hours = CASE
    -- If shift is entirely within morning window (8 AM - 5 PM)
    WHEN clock_in_time >= '08:00:00' AND clock_out_time <= '17:00:00' THEN total_hours
    -- If shift starts before 8 AM and ends before 5 PM
    WHEN clock_in_time < '08:00:00' AND clock_out_time <= '17:00:00' THEN 
      EXTRACT(EPOCH FROM (clock_out_time - '08:00:00'::time)) / 3600
    -- If shift starts after 8 AM and ends after 5 PM  
    WHEN clock_in_time >= '08:00:00' AND clock_out_time > '17:00:00' THEN
      EXTRACT(EPOCH FROM ('17:00:00'::time - clock_in_time)) / 3600
    -- If shift spans entire morning window (starts before 8 AM, ends after 5 PM)
    WHEN clock_in_time < '08:00:00' AND clock_out_time > '17:00:00' THEN 9.0
    -- Otherwise all is night
    ELSE 0
  END,
  night_hours = CASE
    -- Night is total minus morning
    WHEN clock_in_time >= '08:00:00' AND clock_out_time <= '17:00:00' THEN 0
    WHEN clock_in_time < '08:00:00' AND clock_out_time <= '17:00:00' THEN 
      total_hours - (EXTRACT(EPOCH FROM (clock_out_time - '08:00:00'::time)) / 3600)
    WHEN clock_in_time >= '08:00:00' AND clock_out_time > '17:00:00' THEN
      total_hours - (EXTRACT(EPOCH FROM ('17:00:00'::time - clock_in_time)) / 3600)
    WHEN clock_in_time < '08:00:00' AND clock_out_time > '17:00:00' THEN total_hours - 9.0
    ELSE total_hours
  END
WHERE clock_out_time IS NOT NULL
  AND total_hours > 0;

-- Verify the update
SELECT 
  employee_name,
  clock_in_time,
  clock_out_time,
  total_hours,
  morning_hours,
  night_hours
FROM timesheet_entries
WHERE employee_name = 'hend'
  AND clock_in_date = '2025-09-26'
LIMIT 5;

