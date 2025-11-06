-- CLEANUP TEST DATA BEFORE SEPTEMBER 2025
-- This script safely removes old test timesheet entries

-- STEP 1: First, let's see what we're about to delete
DO $$
DECLARE
  test_entries_count INTEGER;
  earliest_date DATE;
  latest_date DATE;
BEGIN
  SELECT 
    COUNT(*),
    MIN(clock_in_date),
    MAX(clock_in_date)
  INTO test_entries_count, earliest_date, latest_date
  FROM public.timesheet_entries
  WHERE clock_in_date < '2025-09-01';
  
  RAISE NOTICE 'Found % test entries before September 2025', test_entries_count;
  RAISE NOTICE 'Date range of test data: % to %', earliest_date, latest_date;
END $$;

-- STEP 2: Show summary by month (optional - for visibility)
SELECT 
  DATE_TRUNC('month', clock_in_date) as month,
  COUNT(*) as entry_count,
  COUNT(DISTINCT employee_id) as unique_employees
FROM public.timesheet_entries
WHERE clock_in_date < '2025-09-01'
GROUP BY DATE_TRUNC('month', clock_in_date)
ORDER BY month;

-- STEP 3: Delete all timesheet entries before September 2025
DELETE FROM public.timesheet_entries
WHERE clock_in_date < '2025-09-01';

-- STEP 4: Verify deletion
DO $$
DECLARE
  remaining_count INTEGER;
  new_earliest_date DATE;
BEGIN
  SELECT 
    COUNT(*),
    MIN(clock_in_date)
  INTO remaining_count, new_earliest_date
  FROM public.timesheet_entries;
  
  RAISE NOTICE 'Cleanup complete!';
  RAISE NOTICE 'Remaining entries: %', remaining_count;
  RAISE NOTICE 'New earliest entry date: %', new_earliest_date;
END $$;

-- STEP 5: Show current data summary
SELECT 
  'Current Data Summary' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT employee_id) as unique_employees,
  MIN(clock_in_date) as earliest_date,
  MAX(clock_in_date) as latest_date,
  COUNT(CASE WHEN clock_out_date IS NULL THEN 1 END) as open_entries
FROM public.timesheet_entries;
