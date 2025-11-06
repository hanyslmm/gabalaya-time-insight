-- FIX DATA QUALITY ISSUES BEFORE APPLYING CONSTRAINTS
-- This script handles: future dates, overnight shifts, and truly invalid entries

-- ============================================================================
-- PART 1: IDENTIFY AND FIX FUTURE DATES (beyond today)
-- ============================================================================

-- Step 1.1: Show entries with future dates beyond reasonable range
SELECT 
  id, employee_name, clock_in_date, clock_in_time, 
  clock_out_date, clock_out_time, total_hours,
  'Future date - needs review' as issue_type
FROM public.timesheet_entries
WHERE clock_in_date > CURRENT_DATE + INTERVAL '7 days'
ORDER BY clock_in_date DESC;

-- Step 1.2: Fix entries where clock_in_date is AFTER clock_out_date (date swap issue)
-- This handles cases where dates were entered in wrong order
UPDATE public.timesheet_entries
SET 
  clock_in_date = clock_out_date,
  clock_out_date = clock_in_date
WHERE 
  clock_out_date IS NOT NULL
  AND clock_in_date > clock_out_date
  AND total_hours BETWEEN 4 AND 14;  -- Reasonable shift duration

-- Step 1.3: Report on fixes made
DO $$
DECLARE
  future_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO future_count
  FROM public.timesheet_entries
  WHERE clock_in_date > CURRENT_DATE + INTERVAL '7 days';
  
  IF future_count > 0 THEN
    RAISE NOTICE 'Warning: Found % entries with dates more than 7 days in the future', future_count;
  ELSE
    RAISE NOTICE '✓ No unreasonable future dates found';
  END IF;
END $$;

-- ============================================================================
-- PART 2: FIX OVERNIGHT SHIFTS (clock_in late, clock_out early next day)
-- ============================================================================

-- Step 2.1: Identify overnight shifts that need fixing
-- These are entries where:
-- - Same clock_in_date and clock_out_date
-- - clock_out_time is earlier than clock_in_time (indicating overnight)
-- - total_hours suggests it's a valid overnight shift (between 4-14 hours)
SELECT 
  id, employee_name, 
  clock_in_date, clock_in_time,
  clock_out_date, clock_out_time,
  total_hours,
  'Overnight shift - will fix clock_out_date' as issue_type
FROM public.timesheet_entries
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND total_hours BETWEEN 4 AND 14
  AND clock_out_date IS NOT NULL
ORDER BY clock_in_date DESC;

-- Step 2.2: Fix overnight shifts by adding 1 day to clock_out_date
UPDATE public.timesheet_entries
SET clock_out_date = clock_out_date + INTERVAL '1 day'
WHERE 
  clock_in_date = clock_out_date
  AND clock_out_time < clock_in_time
  AND total_hours BETWEEN 4 AND 14
  AND clock_out_date IS NOT NULL;

-- ============================================================================
-- PART 3: IDENTIFY TRULY INVALID ENTRIES (to be deleted)
-- ============================================================================

-- Step 3.1: Show remaining invalid entries after fixes
-- These are entries that still have clock_out <= clock_in and should be deleted
SELECT 
  id, employee_name,
  clock_in_date, clock_in_time,
  clock_out_date, clock_out_time,
  total_hours,
  (clock_in_date + clock_in_time) as clock_in_timestamp,
  (clock_out_date + clock_out_time) as clock_out_timestamp,
  'Will be deleted - truly invalid' as issue_type
FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time)
ORDER BY clock_in_date DESC;

-- Step 3.2: Delete truly invalid entries
-- These are entries where even after fixes, clock_out <= clock_in
DELETE FROM public.timesheet_entries
WHERE 
  clock_out_date IS NOT NULL 
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- ============================================================================
-- PART 4: SUMMARY REPORT
-- ============================================================================

-- Show final data summary
SELECT 
  'Data after cleanup' as status,
  COUNT(*) as total_entries,
  COUNT(DISTINCT employee_id) as unique_employees,
  MIN(clock_in_date) as earliest_date,
  MAX(clock_in_date) as latest_date,
  COUNT(CASE WHEN clock_out_date IS NULL THEN 1 END) as open_entries,
  COUNT(CASE WHEN clock_in_date > CURRENT_DATE THEN 1 END) as future_entries,
  COUNT(CASE 
    WHEN clock_out_date IS NOT NULL 
    AND clock_out_time IS NOT NULL
    AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time) 
    THEN 1 
  END) as remaining_invalid_entries
FROM public.timesheet_entries;

-- Verify no invalid entries remain
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.timesheet_entries
  WHERE 
    clock_out_date IS NOT NULL 
    AND clock_out_time IS NOT NULL
    AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Warning: % invalid entries still exist after cleanup', invalid_count;
  ELSE
    RAISE NOTICE '✓ Success: All invalid entries have been cleaned up!';
  END IF;
END $$;
