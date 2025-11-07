-- TIMESHEET DATA QUALITY VIEWS
-- Read-only helpers for operations to quickly spot issues

-- View 1: Entries with invalid durations (end <= start)
CREATE OR REPLACE VIEW public.timesheet_invalid_duration_v AS
SELECT
  id,
  employee_id,
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_date,
  clock_out_time,
  total_hours,
  (clock_in_date + clock_in_time)  AS start_ts,
  (clock_out_date + clock_out_time) AS end_ts
FROM public.timesheet_entries
WHERE clock_out_date IS NOT NULL
  AND clock_out_time IS NOT NULL
  AND (clock_in_date + clock_in_time) >= (clock_out_date + clock_out_time);

-- View 2: Overlapping pairs (should be empty after constraints)
-- Suggests which id to delete (shorter; if equal duration, newer)
CREATE OR REPLACE VIEW public.timesheet_overlaps_v AS
WITH v AS (
  SELECT
    id, employee_id, employee_name,
    (total_hours)::numeric AS hours, created_at,
    (clock_in_date + clock_in_time)  AS start_ts,
    (clock_out_date + clock_out_time) AS end_ts
  FROM public.timesheet_entries
  WHERE clock_out_date IS NOT NULL
    AND clock_out_time IS NOT NULL
    AND (clock_in_date + clock_in_time) < (clock_out_date + clock_out_time)
)
SELECT
  v1.employee_id,
  v1.employee_name,
  v1.id AS id1, v1.start_ts AS start1, v1.end_ts AS end1, v1.hours AS hours1, v1.created_at AS created1,
  v2.id AS id2, v2.start_ts AS start2, v2.end_ts AS end2, v2.hours AS hours2, v2.created_at AS created2,
  CASE
    WHEN v1.hours < v2.hours THEN v1.id
    WHEN v2.hours < v1.hours THEN v2.id
    WHEN v1.created_at > v2.created_at THEN v1.id
    ELSE v2.id
  END AS id_to_delete
FROM v v1
JOIN v v2
  ON v1.employee_id = v2.employee_id
 AND v1.id < v2.id
WHERE
  v1.start_ts < v2.end_ts
  AND v2.start_ts < v1.end_ts;

COMMENT ON VIEW public.timesheet_invalid_duration_v IS
'Shows timesheet entries where end <= start (invalid durations). Should be empty.';

COMMENT ON VIEW public.timesheet_overlaps_v IS
'Shows overlapping pairs (should be empty). Provides id_to_delete suggestion based on shorter or newer.';


