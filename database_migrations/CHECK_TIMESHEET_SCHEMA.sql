-- Check the column types for timesheet_entries table
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'timesheet_entries'
  AND column_name IN ('clock_in_time', 'clock_out_time', 'clock_in_date', 'clock_out_date')
ORDER BY ordinal_position;

-- If clock_in_time and clock_out_time are TIMETZ (time with timezone),
-- we need to change them to TIME (time without timezone)

-- To fix:
-- ALTER TABLE timesheet_entries 
-- ALTER COLUMN clock_in_time TYPE TIME WITHOUT TIME ZONE USING clock_in_time::time;
-- 
-- ALTER TABLE timesheet_entries 
-- ALTER COLUMN clock_out_time TYPE TIME WITHOUT TIME ZONE USING clock_out_time::time;

