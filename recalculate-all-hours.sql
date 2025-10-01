-- Recalculate all timesheet entries with new morning/night split
-- Morning: 6 AM to 5 PM
-- Night: 5 PM to 6 AM

UPDATE timesheet_entries
SET 
  morning_hours = CASE
    WHEN clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL THEN
      GREATEST(0, 
        LEAST(
          -- Calculate overlap with morning window (6 AM to 5 PM)
          CASE
            WHEN clock_out_time < clock_in_time THEN -- Overnight shift
              CASE
                WHEN clock_in_time::time >= '06:00:00'::time AND clock_in_time::time < '17:00:00'::time THEN
                  -- Started in morning
                  LEAST(
                    EXTRACT(EPOCH FROM ('17:00:00'::time - clock_in_time::time)) / 3600.0,
                    EXTRACT(EPOCH FROM (clock_out_time::time + INTERVAL '24 hours' - clock_in_time::time)) / 3600.0
                  )
                WHEN clock_out_time::time >= '06:00:00'::time AND clock_out_time::time <= '17:00:00'::time THEN
                  -- Ended in morning
                  EXTRACT(EPOCH FROM (clock_out_time::time - '06:00:00'::time)) / 3600.0
                WHEN clock_in_time::time < '06:00:00'::time AND clock_out_time::time > '17:00:00'::time THEN
                  -- Spans entire morning
                  11.0 -- 6 AM to 5 PM = 11 hours
                ELSE
                  0
              END
            ELSE -- Same day shift
              CASE
                WHEN clock_in_time::time >= '17:00:00'::time OR clock_out_time::time <= '06:00:00'::time THEN
                  -- Completely outside morning hours
                  0
                ELSE
                  -- Calculate overlap
                  EXTRACT(EPOCH FROM (
                    LEAST(clock_out_time::time, '17:00:00'::time) - 
                    GREATEST(clock_in_time::time, '06:00:00'::time)
                  )) / 3600.0
              END
          END,
          24.0
        )
      )
    ELSE 0
  END,
  night_hours = CASE
    WHEN clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL THEN
      CASE
        WHEN clock_out_time < clock_in_time THEN -- Overnight shift
          -- Night hours = total hours - morning hours
          EXTRACT(EPOCH FROM (clock_out_time::time + INTERVAL '24 hours' - clock_in_time::time)) / 3600.0 -
          GREATEST(0, 
            LEAST(
              CASE
                WHEN clock_in_time::time >= '06:00:00'::time AND clock_in_time::time < '17:00:00'::time THEN
                  LEAST(
                    EXTRACT(EPOCH FROM ('17:00:00'::time - clock_in_time::time)) / 3600.0,
                    EXTRACT(EPOCH FROM (clock_out_time::time + INTERVAL '24 hours' - clock_in_time::time)) / 3600.0
                  )
                WHEN clock_out_time::time >= '06:00:00'::time AND clock_out_time::time <= '17:00:00'::time THEN
                  EXTRACT(EPOCH FROM (clock_out_time::time - '06:00:00'::time)) / 3600.0
                WHEN clock_in_time::time < '06:00:00'::time AND clock_out_time::time > '17:00:00'::time THEN
                  11.0
                ELSE
                  0
              END,
              24.0
            )
          )
        ELSE -- Same day shift
          -- Night hours = total hours - morning hours
          EXTRACT(EPOCH FROM (clock_out_time::time - clock_in_time::time)) / 3600.0 -
          CASE
            WHEN clock_in_time::time >= '17:00:00'::time OR clock_out_time::time <= '06:00:00'::time THEN
              0
            ELSE
              GREATEST(0,
                EXTRACT(EPOCH FROM (
                  LEAST(clock_out_time::time, '17:00:00'::time) - 
                  GREATEST(clock_in_time::time, '06:00:00'::time)
                )) / 3600.0
              )
          END
      END
    ELSE 0
  END,
  is_split_calculation = true
WHERE clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_records,
  SUM(total_hours) as total_hours_sum,
  SUM(morning_hours) as morning_hours_sum,
  SUM(night_hours) as night_hours_sum,
  SUM(total_hours - (morning_hours + night_hours)) as unassigned_hours
FROM timesheet_entries
WHERE clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL;
