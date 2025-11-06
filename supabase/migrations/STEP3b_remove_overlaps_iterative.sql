-- STEP 3B: ITERATIVELY REMOVE ALL OVERLAPS (KEEP LONGER, IF EQUAL KEEP OLDER)
-- Run this after STEP1 and STEP2, and before adding the constraint

DO $$
DECLARE
  deleted_this_round INTEGER := 0;
  total_deleted INTEGER := 0;
BEGIN
  LOOP
    WITH pairs AS (
      SELECT 
        t1.id     AS id1,
        t1.total_hours AS h1,
        t1.created_at  AS c1,
        (t1.clock_in_date + t1.clock_in_time)  AS s1,
        (t1.clock_out_date + t1.clock_out_time) AS e1,
        t2.id     AS id2,
        t2.total_hours AS h2,
        t2.created_at  AS c2,
        (t2.clock_in_date + t2.clock_in_time)  AS s2,
        (t2.clock_out_date + t2.clock_out_time) AS e2
      FROM public.timesheet_entries t1
      JOIN public.timesheet_entries t2
        ON t1.employee_id = t2.employee_id
       AND t1.id < t2.id
      WHERE 
        t1.clock_out_date IS NOT NULL AND t1.clock_out_time IS NOT NULL
        AND t2.clock_out_date IS NOT NULL AND t2.clock_out_time IS NOT NULL
        -- Only consider valid durations
        AND (t1.clock_in_date + t1.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
        AND (t2.clock_in_date + t2.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
        -- Overlap condition (manual timestamps)
        AND (t1.clock_in_date + t1.clock_in_time) < (t2.clock_out_date + t2.clock_out_time)
        AND (t2.clock_in_date + t2.clock_in_time) < (t1.clock_out_date + t1.clock_out_time)
    ), ids_to_delete AS (
      SELECT DISTINCT
        CASE
          WHEN h1 < h2 THEN id1
          WHEN h2 < h1 THEN id2
          ELSE CASE WHEN c1 > c2 THEN id1 ELSE id2 END
        END AS id_to_delete
      FROM pairs
    )
    DELETE FROM public.timesheet_entries t
    USING ids_to_delete d
    WHERE t.id = d.id_to_delete;

    GET DIAGNOSTICS deleted_this_round = ROW_COUNT;
    IF deleted_this_round = 0 THEN
      EXIT; -- no more overlaps to resolve
    END IF;
    total_deleted := total_deleted + deleted_this_round;
  END LOOP;
  RAISE NOTICE 'Iterative cleanup complete. Deleted % overlapping entries in total.', total_deleted;
END $$;
