-- Migration: Update get_task_performance_report to include rounds
-- Date: 2025-01-15
-- Description: Updates get_task_performance_report function to include tasks from rounds based on day schedules and date overrides
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- FUNCTION: get_task_performance_report (UPDATED)
-- Purpose: Returns task completion statistics including round-based tasks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_task_performance_report(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_employee_id UUID DEFAULT NULL -- Optional filter
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_staff_id TEXT,
  employee_role TEXT,
  total_tasks_assigned INTEGER,
  total_tasks_completed INTEGER,
  completion_rate DECIMAL(5,2),
  shifts_with_tasks INTEGER,
  shifts_completed_all_tasks INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate inputs
  IF p_organization_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN; -- Return empty if invalid inputs
  END IF;

  IF p_start_date > p_end_date THEN
    RETURN; -- Invalid date range
  END IF;

  RETURN QUERY
  WITH shift_tasks AS (
    -- Get all tasks assigned to each employee for their shifts
    -- Includes: role assignments, user assignments, AND round assignments
    SELECT DISTINCT
      te.id AS timesheet_entry_id,
      te.employee_id,
      t.id AS task_id,
      t.name AS task_name,
      te.clock_in_date
    FROM public.timesheet_entries te
    INNER JOIN public.employees e ON e.id = te.employee_id
    CROSS JOIN LATERAL (
      -- Tasks via role (direct assignment)
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.role_tasks rt ON rt.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND rt.organization_id = p_organization_id
        AND rt.is_active = true
        AND rt.role_name = e.role
      
      UNION
      
      -- Tasks via user assignment (direct assignment)
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.user_tasks ut ON ut.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND ut.organization_id = p_organization_id
        AND ut.is_active = true
        AND ut.employee_id = e.id
      
      UNION
      
      -- Tasks from rounds assigned to role (via day schedule or date override)
      SELECT DISTINCT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.round_tasks rt ON rt.task_id = t.id
      INNER JOIN public.rounds r ON r.id = rt.round_id
      INNER JOIN public.round_assignments ra ON ra.round_id = r.id
      LEFT JOIN public.round_schedules rs ON rs.round_assignment_id = ra.id 
        AND rs.day_of_week = EXTRACT(DOW FROM te.clock_in_date)
      LEFT JOIN public.round_date_overrides rdo ON rdo.round_assignment_id = ra.id 
        AND rdo.override_date = te.clock_in_date 
        AND rdo.is_active = true
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND r.organization_id = p_organization_id
        AND r.is_active = true
        AND ra.organization_id = p_organization_id
        AND ra.is_active = true
        AND ra.assignment_type = 'role'
        AND ra.role_name = e.role
        AND (
          rs.id IS NOT NULL -- Day schedule matches
          OR rdo.id IS NOT NULL -- Date override exists
        )
      
      UNION
      
      -- Tasks from rounds assigned to user (via day schedule or date override)
      SELECT DISTINCT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.round_tasks rt ON rt.task_id = t.id
      INNER JOIN public.rounds r ON r.id = rt.round_id
      INNER JOIN public.round_assignments ra ON ra.round_id = r.id
      LEFT JOIN public.round_schedules rs ON rs.round_assignment_id = ra.id 
        AND rs.day_of_week = EXTRACT(DOW FROM te.clock_in_date)
      LEFT JOIN public.round_date_overrides rdo ON rdo.round_assignment_id = ra.id 
        AND rdo.override_date = te.clock_in_date 
        AND rdo.is_active = true
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND r.organization_id = p_organization_id
        AND r.is_active = true
        AND ra.organization_id = p_organization_id
        AND ra.is_active = true
        AND ra.assignment_type = 'user'
        AND ra.employee_id = e.id
        AND (
          rs.id IS NOT NULL -- Day schedule matches
          OR rdo.id IS NOT NULL -- Date override exists
        )
    ) t
    WHERE te.organization_id = p_organization_id
      AND te.clock_in_date >= p_start_date
      AND te.clock_in_date <= p_end_date
      AND (p_employee_id IS NULL OR te.employee_id = p_employee_id)
  ),
  completions AS (
    SELECT 
      st.timesheet_entry_id,
      st.employee_id,
      st.task_id,
      CASE WHEN stc.id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
    FROM shift_tasks st
    LEFT JOIN public.shift_task_completions stc 
      ON stc.timesheet_entry_id = st.timesheet_entry_id
      AND stc.task_id = st.task_id
      AND stc.organization_id = p_organization_id
  ),
  employee_stats AS (
    SELECT 
      c.employee_id,
      COUNT(*)::INTEGER AS total_tasks_assigned, -- Count all task-shift combinations
      SUM(c.is_completed)::INTEGER AS total_tasks_completed, -- Count all completions
      COUNT(DISTINCT c.timesheet_entry_id)::INTEGER AS shifts_with_tasks,
      COUNT(DISTINCT CASE 
        WHEN c.timesheet_entry_id IN (
          SELECT timesheet_entry_id 
          FROM completions 
          GROUP BY timesheet_entry_id 
          HAVING SUM(is_completed) = COUNT(*)
        ) THEN c.timesheet_entry_id 
      END)::INTEGER AS shifts_completed_all_tasks
    FROM completions c
    GROUP BY c.employee_id
  )
  SELECT 
    e.id AS employee_id,
    e.full_name AS employee_name,
    e.staff_id AS employee_staff_id,
    e.role AS employee_role,
    es.total_tasks_assigned,
    es.total_tasks_completed,
    CASE 
      WHEN es.total_tasks_assigned > 0 
      THEN ROUND((es.total_tasks_completed::DECIMAL / es.total_tasks_assigned) * 100, 2)
      ELSE 0::DECIMAL
    END AS completion_rate,
    es.shifts_with_tasks,
    es.shifts_completed_all_tasks
  FROM public.employees e
  INNER JOIN employee_stats es ON es.employee_id = e.id
  WHERE e.organization_id = p_organization_id
    AND (p_employee_id IS NULL OR e.id = p_employee_id)
    AND es.total_tasks_assigned > 0 -- Only show employees who had tasks assigned
  ORDER BY e.full_name;
END;
$$;

COMMIT;

