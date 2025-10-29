-- ============================================================================
-- SAFE FIX: Only update entries where hour_24 is between 0-20 (UTC times)
-- This won't touch entries where hour_24 is 21-23 (already Cairo time)
-- ============================================================================

-- First, let's check which entries will be updated (preview)
SELECT 
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_time,
  EXTRACT(HOUR FROM clock_in_time) as hour_24,
  CASE 
    WHEN EXTRACT(HOUR FROM clock_in_time) < 21 THEN 'WILL BE UPDATED'
    ELSE 'ALREADY CORRECT'
  END as status
FROM timesheet_entries
WHERE employee_name = 'Maha Khalil'
  AND clock_in_date = '2025-10-29'
ORDER BY clock_in_time DESC;

-- ============================================================================
-- Now run the SAFE update - only touches entries with hour < 21
-- ============================================================================

UPDATE timesheet_entries
SET 
  clock_in_time = clock_in_time + interval '3 hours',
  clock_out_time = CASE 
    WHEN clock_out_time IS NOT NULL 
    THEN clock_out_time + interval '3 hours'
    ELSE NULL
  END
WHERE EXTRACT(HOUR FROM clock_in_time) < 21;  -- Only fix UTC entries (hour < 21)

-- ============================================================================
-- Verify the fix worked
-- ============================================================================

SELECT 
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_time,
  EXTRACT(HOUR FROM clock_in_time) as hour_24,
  'All hours should now be 21-23 range for evening entries' as note
FROM timesheet_entries
WHERE employee_name = 'Maha Khalil'
  AND clock_in_date = '2025-10-29'
ORDER BY clock_in_time DESC;

-- ============================================================================
-- Check all entries to see how many were updated
-- ============================================================================

SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN EXTRACT(HOUR FROM clock_in_time) >= 21 THEN 1 END) as evening_entries_21_to_23,
  COUNT(CASE WHEN EXTRACT(HOUR FROM clock_in_time) < 21 THEN 1 END) as should_be_zero_if_all_fixed
FROM timesheet_entries;

