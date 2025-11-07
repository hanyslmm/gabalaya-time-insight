-- CONSTRAINTS VERIFICATION (READ-ONLY/SAFE TO RUN IN A TRANSACTION)
-- Validates behavior:
-- 1) Back-to-back entries are allowed for the same employee (end == next start)
-- 2) Overlapping entries are blocked by exclusion constraint

-- Replace this with a real employee UUID to test against actual user if desired.
-- Using a random UUID avoids conflicts with real data when wrapped in a transaction.
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000001'::uuid AS employee_id
)
SELECT 'Ready to verify constraints. Use the following guidance:' AS info;

-- Back-to-back should succeed:
-- BEGIN;
-- INSERT INTO public.timesheet_entries (id, employee_id, employee_name, clock_in_date, clock_in_time, clock_out_date, clock_out_time, total_hours)
-- SELECT gen_random_uuid(), p.employee_id, 'Constraint Test', '2025-11-07', '09:00', '2025-11-07', '10:00', 1.0 FROM params p;
-- INSERT INTO public.timesheet_entries (id, employee_id, employee_name, clock_in_date, clock_in_time, clock_out_date, clock_out_time, total_hours)
-- SELECT gen_random_uuid(), p.employee_id, 'Constraint Test', '2025-11-07', '10:00', '2025-11-07', '11:00', 1.0 FROM params p;
-- ROLLBACK;

-- Overlap should fail with 23P01 (exclusion violation):
-- BEGIN;
-- INSERT INTO public.timesheet_entries (id, employee_id, employee_name, clock_in_date, clock_in_time, clock_out_date, clock_out_time, total_hours)
-- SELECT gen_random_uuid(), p.employee_id, 'Constraint Test', '2025-11-07', '09:00', '2025-11-07', '11:00', 2.0 FROM params p;
-- -- Overlaps the previous row on purpose:
-- INSERT INTO public.timesheet_entries (id, employee_id, employee_name, clock_in_date, clock_in_time, clock_out_date, clock_out_time, total_hours)
-- SELECT gen_random_uuid(), p.employee_id, 'Constraint Test', '2025-11-07', '10:00', '2025-11-07', '12:00', 2.0 FROM params p;
-- ROLLBACK;

-- Quick checks: views should be empty after cleanup + constraints
SELECT 'invalid_duration_count' AS check, COUNT(*) AS value FROM public.timesheet_invalid_duration_v
UNION ALL
SELECT 'overlaps_count' AS check, COUNT(*) AS value FROM public.timesheet_overlaps_v;


