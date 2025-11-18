-- Migration: Update get_tasks_for_shift to include rounds
-- Date: 2025-01-15
-- Description: Updates get_tasks_for_shift function to include tasks from rounds based on day schedules and date overrides
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- FUNCTION: get_tasks_for_shift (UPDATED)
-- Purpose: Retrieves tasks assigned via role, user, OR rounds (with day schedules and date overrides)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_tasks_for_shift(
  p_timesheet_entry_id UUID,
  p_employee_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  task_description TEXT,
  assignment_type TEXT, -- 'role', 'user', or 'round'
  is_completed BOOLEAN,
  completed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_role TEXT;
  v_staff_id TEXT;
  v_shift_date DATE;
  v_day_of_week INTEGER;
BEGIN
  -- Validate inputs
  IF p_timesheet_entry_id IS NULL OR p_employee_id IS NULL OR p_organization_id IS NULL THEN
    RETURN; -- Return empty result if invalid inputs
  END IF;

  -- Get employee role and staff_id
  SELECT role, staff_id INTO v_employee_role, v_staff_id
  FROM public.employees
  WHERE id = p_employee_id AND organization_id = p_organization_id;
  
  IF v_employee_role IS NULL THEN
    RETURN; -- Employee not found, return empty
  END IF;

  -- Get shift date from timesheet entry
  SELECT clock_in_date INTO v_shift_date
  FROM public.timesheet_entries
  WHERE id = p_timesheet_entry_id AND organization_id = p_organization_id;

  IF v_shift_date IS NULL THEN
    RETURN; -- Timesheet entry not found
  END IF;

  -- Calculate day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM v_shift_date);
  
  -- Return tasks assigned via role, user, OR rounds
  RETURN QUERY
  WITH assigned_tasks AS (
    -- Tasks assigned to the employee's role (direct assignment)
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'role'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.role_tasks rt ON rt.task_id = t.id
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND rt.organization_id = p_organization_id
      AND rt.is_active = true
      AND rt.role_name = v_employee_role
    
    UNION
    
    -- Tasks assigned specifically to this user (direct assignment)
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'user'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.user_tasks ut ON ut.task_id = t.id
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND ut.organization_id = p_organization_id
      AND ut.is_active = true
      AND ut.employee_id = p_employee_id
    
    UNION
    
    -- Tasks from rounds assigned to role (via day schedule or date override)
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'round'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.round_tasks rt ON rt.task_id = t.id
    INNER JOIN public.rounds r ON r.id = rt.round_id
    INNER JOIN public.round_assignments ra ON ra.round_id = r.id
    LEFT JOIN public.round_schedules rs ON rs.round_assignment_id = ra.id AND rs.day_of_week = v_day_of_week
    LEFT JOIN public.round_date_overrides rdo ON rdo.round_assignment_id = ra.id 
      AND rdo.override_date = v_shift_date 
      AND rdo.is_active = true
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND r.organization_id = p_organization_id
      AND r.is_active = true
      AND ra.organization_id = p_organization_id
      AND ra.is_active = true
      AND ra.assignment_type = 'role'
      AND ra.role_name = v_employee_role
      AND (
        rs.id IS NOT NULL -- Day schedule matches
        OR rdo.id IS NOT NULL -- Date override exists
      )
    
    UNION
    
    -- Tasks from rounds assigned to user (via day schedule or date override)
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'round'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.round_tasks rt ON rt.task_id = t.id
    INNER JOIN public.rounds r ON r.id = rt.round_id
    INNER JOIN public.round_assignments ra ON ra.round_id = r.id
    LEFT JOIN public.round_schedules rs ON rs.round_assignment_id = ra.id AND rs.day_of_week = v_day_of_week
    LEFT JOIN public.round_date_overrides rdo ON rdo.round_assignment_id = ra.id 
      AND rdo.override_date = v_shift_date 
      AND rdo.is_active = true
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND r.organization_id = p_organization_id
      AND r.is_active = true
      AND ra.organization_id = p_organization_id
      AND ra.is_active = true
      AND ra.assignment_type = 'user'
      AND ra.employee_id = p_employee_id
      AND (
        rs.id IS NOT NULL -- Day schedule matches
        OR rdo.id IS NOT NULL -- Date override exists
      )
  )
  SELECT 
    at.task_id,
    at.task_name,
    at.task_description,
    at.assignment_type,
    COALESCE(stc.completed_at IS NOT NULL, false) AS is_completed,
    stc.completed_at
  FROM assigned_tasks at
  LEFT JOIN public.shift_task_completions stc 
    ON stc.task_id = at.task_id 
    AND stc.timesheet_entry_id = p_timesheet_entry_id
  ORDER BY at.assignment_type, at.task_name;
END;
$$;

COMMIT;

