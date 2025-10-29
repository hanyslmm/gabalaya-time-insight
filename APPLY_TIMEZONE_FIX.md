# Fix Timezone Issue - Apply This Now

## Problem
- Times are stored as UTC (20:14) instead of Cairo time (23:14)
- Display shows 8:14 PM instead of 11:14 PM

## Solution
Apply the timezone fix migration to correct the `clock_in` and `clock_out` functions.

## Steps to Apply

### Option 1: Via Supabase Dashboard (EASIEST)

1. Go to: https://supabase.com/dashboard/project/npmniesphobtsoftczeh/sql/new
2. Copy the entire content from: `supabase/migrations/20251029000000_fix_clock_functions_timezone.sql`
3. Paste into the SQL Editor
4. Click "Run" (▶️)
5. You should see: "Success. No rows returned"

### Option 2: Via CLI

```bash
cd /Users/enghon/projects/gabalaya-time-insight/gabalaya-time-insight
supabase db push
# Enter your database password when prompted
```

## Verification

After applying, test with a new clock-in:

```sql
-- Check that new entries store Cairo time (hour should be 23 for 11 PM, not 20)
SELECT 
  employee_name,
  clock_in_time,
  EXTRACT(HOUR FROM clock_in_time) as hour_24,
  created_at
FROM timesheet_entries
ORDER BY created_at DESC
LIMIT 5;
```

Expected: If you clock in at 11:00 PM Cairo time, `hour_24` should show **23**, not **20**.

## For Existing Wrong Entries

Old entries (like Maha's 20:14) are stored incorrectly. To fix them, run:

```sql
-- Add 3 hours to all existing times to convert from UTC to Cairo
UPDATE timesheet_entries
SET 
  clock_in_time = clock_in_time + interval '3 hours',
  clock_out_time = CASE 
    WHEN clock_out_time IS NOT NULL 
    THEN clock_out_time + interval '3 hours'
    ELSE NULL
  END
WHERE created_at < '2025-10-29 21:00:00+00'  -- Only fix entries before the migration
  AND EXTRACT(HOUR FROM clock_in_time) < 21;  -- Safety: only fix UTC times (< 21:00)

-- Verify the fix
SELECT 
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_time,
  EXTRACT(HOUR FROM clock_in_time) as hour_24
FROM timesheet_entries
WHERE employee_name = 'Maha Khalil'
  AND clock_in_date = '2025-10-29'
ORDER BY clock_in_time DESC;
```

Expected: Maha's entry should now show `23:14:23` instead of `20:14:23`.

## After Fix

- New clock-ins will store correct Cairo time
- Display will show correct times (11:14 PM instead of 8:14 PM)
- Morning/night split will calculate correctly based on Cairo time

