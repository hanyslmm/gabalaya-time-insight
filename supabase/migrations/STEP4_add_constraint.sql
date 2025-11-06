-- STEP 4: ADD CONSTRAINT TO PREVENT FUTURE OVERLAPS
-- Run this LAST after all data is clean

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop constraint if exists
ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_no_overlap_excl;

-- Add the constraint
ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_no_overlap_excl
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      (clock_in_date + clock_in_time),
      COALESCE((clock_out_date + clock_out_time), 'infinity'::timestamp),
      '[]'
    ) WITH &&
  );

-- Verify constraint is added
SELECT 
  'Constraint added successfully!' as status,
  conname as constraint_name
FROM pg_constraint
WHERE conrelid = 'public.timesheet_entries'::regclass
  AND conname = 'timesheet_no_overlap_excl';
