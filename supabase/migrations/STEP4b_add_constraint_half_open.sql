-- STEP 4B: ADD EXCLUSION CONSTRAINT USING HALF-OPEN RANGE [)
-- Allows back-to-back entries where next start == previous end

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_no_overlap_excl;

ALTER TABLE public.timesheet_entries
  ADD CONSTRAINT timesheet_no_overlap_excl
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      (clock_in_date + clock_in_time),
      COALESCE((clock_out_date + clock_out_time), 'infinity'::timestamp),
      '[)'
    ) WITH &&
  );

COMMENT ON CONSTRAINT timesheet_no_overlap_excl ON public.timesheet_entries
IS 'Prevents overlapping intervals per employee. Half-open range [) allows adjacent entries.';
