-- FIX OVERNIGHT SHIFTS ONLY
-- This script fixes entries where clock_out should be on the next day

-- ============================================================================
-- PART 1: IDENTIFY OVERNIGHT SHIFTS THAT NEED FIXING
-- ============================================================================

-- Show what will be fixed
SELECT 
  id, employee_name, 
  clock_in_date, 
  to_char(clock_in_time, 'HH24:MI') as clock_in_time,
  clock_out_date, 
  to_char(clock_out_time, 'HH24:MI') as clock_out_time,
  total_hours,
  'Will add 1 day to clock_out_date' as action
FROM public.timesheet_entries
WHERE 
  -- Same date for in and out
  clock_in_date = clock_out_date
  -- But clock_out time is earlier than clock_in time (overnight)
  AND clock_out_time < clock_in_time
  -- And it's a reasonable shift duration
  AND total_hours BETWEEN 4 AND 14
  -- And it's a closed entry
  AND clock_out_date IS NOT NULL
ORDER BY clock_in_date DESC, employee_name;

-- ============================================================================
-- PART 2: FIX OVERNIGHT SHIFTS
-- ============================================================================

-- Add 1 day to clock_out_date for overnight shifts
UPDATE public.timesheet_entries
SET clock_out_date = clock_out_date + INTERVAL '1 day'
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND total_hours BETWEEN 4 AND 14
  AND clock_out_date IS NOT NULL;

-- ============================================================================
-- PART 3: DELETE TRULY INVALID ENTRIES
-- ============================================================================

-- Show what will be deleted (entries that are still invalid after fixes)
SELECT 
  id, employee_name,
  clock_in_date, clock_in_time,
  clock_out_date, clock_out_time,
  total_hours,
  'Will be deleted - invalid duration' as action
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- Delete entries where clock_out <= clock_in (truly invalid)
DELETE FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- ============================================================================
-- PART 4: FINAL VERIFICATION
-- ============================================================================

-- Verify no invalid entries remain
DO $$
DECLARE
  invalid_count INTEGER;
  fixed_count INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Count any remaining invalid entries
  SELECT COUNT(*) INTO invalid_count
  FROM public.timesheet_entries
  WHERE 
    clock_out_date IS NOT NULL 
    AND clock_out_time IS NOT NULL
    AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);
  
  IF invalid_count > 0 THEN
    RAISE WARNING '⚠ Warning: % invalid entries still exist', invalid_count;
  ELSE
    RAISE NOTICE '✓ Success: All data quality issues have been resolved!';
    RAISE NOTICE '  Ready to apply constraints in next migration.';
  END IF;
END $$;

-- Show final summary
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT employee_id) as unique_employees,
  MIN(clock_in_date) as earliest_date,
  MAX(clock_in_date) as latest_date,
  COUNT(CASE WHEN clock_out_date IS NULL THEN 1 END) as open_entries
FROM public.timesheet_entries;
