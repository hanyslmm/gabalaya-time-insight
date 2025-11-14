-- Migration: Create Shift Task Management Functions
-- Date: 2025-01-15
-- Description: Creates RPC functions for task retrieval, completion tracking, and performance reporting
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- FUNCTION 1: get_tasks_for_shift
-- Purpose: Called after successful clock-in to retrieve all tasks assigned to the user
--          (via role or user-specific assignment)
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
  assignment_type TEXT, -- 'role' or 'user'
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
  
  -- Return tasks assigned via role OR user-specific assignment
  RETURN QUERY
  WITH assigned_tasks AS (
    -- Tasks assigned to the employee's role
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
    
    -- Tasks assigned specifically to this user
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
  ORDER BY at.task_name;
END;
$$;

-- ============================================================================
-- FUNCTION 2: complete_shift_task
-- Purpose: Marks a task as completed for a specific shift
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_shift_task(
  p_timesheet_entry_id UUID,
  p_task_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id UUID;
  v_user_id UUID;
  v_username TEXT;
  v_completion_id UUID;
BEGIN
  -- Validate inputs
  IF p_timesheet_entry_id IS NULL OR p_task_id IS NULL OR p_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;

  -- Get employee_id from timesheet entry
  SELECT employee_id INTO v_employee_id
  FROM public.timesheet_entries
  WHERE id = p_timesheet_entry_id
    AND organization_id = p_organization_id;
  
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Timesheet entry not found');
  END IF;
  
  -- Get current user ID (from auth context)
  v_username := auth.jwt() ->> 'username'::text;
  
  IF v_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get user ID from admin_users table
  SELECT id INTO v_user_id
  FROM public.admin_users
  WHERE username = v_username
  LIMIT 1;
  
  -- Insert completion record (ON CONFLICT DO UPDATE to handle re-completion)
  INSERT INTO public.shift_task_completions (
    organization_id,
    timesheet_entry_id,
    task_id,
    employee_id,
    completed_by
  )
  VALUES (
    p_organization_id,
    p_timesheet_entry_id,
    p_task_id,
    v_employee_id,
    v_user_id
  )
  ON CONFLICT (timesheet_entry_id, task_id) 
  DO UPDATE SET 
    completed_at = now(),
    completed_by = v_user_id
  RETURNING id INTO v_completion_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'completion_id', v_completion_id,
    'completed_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCTION 3: uncomplete_shift_task
-- Purpose: Removes a task completion (allows unchecking)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.uncomplete_shift_task(
  p_timesheet_entry_id UUID,
  p_task_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_timesheet_entry_id IS NULL OR p_task_id IS NULL OR p_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;

  -- Verify timesheet entry belongs to organization
  SELECT employee_id INTO v_employee_id
  FROM public.timesheet_entries
  WHERE id = p_timesheet_entry_id
    AND organization_id = p_organization_id;
  
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Timesheet entry not found');
  END IF;
  
  -- Delete completion record
  DELETE FROM public.shift_task_completions
  WHERE timesheet_entry_id = p_timesheet_entry_id
    AND task_id = p_task_id
    AND organization_id = p_organization_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Completion record not found');
  END IF;
  
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCTION 4: get_task_performance_report
-- Purpose: Returns task completion statistics for the performance report page
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
    SELECT DISTINCT
      te.id AS timesheet_entry_id,
      te.employee_id,
      t.id AS task_id,
      t.name AS task_name
    FROM public.timesheet_entries te
    INNER JOIN public.employees e ON e.id = te.employee_id
    CROSS JOIN LATERAL (
      -- Tasks via role
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.role_tasks rt ON rt.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND rt.organization_id = p_organization_id
        AND rt.is_active = true
        AND rt.role_name = e.role
      
      UNION
      
      -- Tasks via user assignment
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.user_tasks ut ON ut.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND ut.organization_id = p_organization_id
        AND ut.is_active = true
        AND ut.employee_id = e.id
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
  )
  SELECT 
    e.id AS employee_id,
    e.full_name AS employee_name,
    e.staff_id AS employee_staff_id,
    e.role AS employee_role,
    COUNT(DISTINCT c.task_id)::INTEGER AS total_tasks_assigned,
    SUM(c.is_completed)::INTEGER AS total_tasks_completed,
    CASE 
      WHEN COUNT(DISTINCT c.task_id) > 0 
      THEN ROUND((SUM(c.is_completed)::DECIMAL / COUNT(DISTINCT c.task_id)) * 100, 2)
      ELSE 0::DECIMAL
    END AS completion_rate,
    COUNT(DISTINCT c.timesheet_entry_id)::INTEGER AS shifts_with_tasks,
    COUNT(DISTINCT CASE 
      WHEN c.timesheet_entry_id IN (
        SELECT timesheet_entry_id 
        FROM completions 
        GROUP BY timesheet_entry_id 
        HAVING SUM(is_completed) = COUNT(*)
      ) THEN c.timesheet_entry_id 
    END)::INTEGER AS shifts_completed_all_tasks
  FROM public.employees e
  INNER JOIN completions c ON c.employee_id = e.id
  WHERE e.organization_id = p_organization_id
  GROUP BY e.id, e.full_name, e.staff_id, e.role
  ORDER BY e.full_name;
END;
$$;

COMMIT;


