-- Migration: Fix Task Completion Functions for Employees
-- Date: 2025-01-15
-- Description: Fixes complete_shift_task and uncomplete_shift_task to work with employees
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- FUNCTION: complete_shift_task (Fixed)
-- Purpose: Marks a task as completed - works for both admins and employees
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
  
  -- Try to get username from JWT (might be null for employees)
  v_username := COALESCE(
    auth.jwt() ->> 'username'::text,
    current_setting('request.jwt.claims', true)::json ->> 'username'
  );
  
  -- If username exists, try to get admin user ID (optional - can be NULL)
  IF v_username IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.admin_users
    WHERE username = v_username
    LIMIT 1;
  END IF;
  
  -- If no admin user found, v_user_id will be NULL, which is fine
  -- Employees can complete their own tasks without being in admin_users table
  
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
    v_user_id  -- Can be NULL for employees
  )
  ON CONFLICT (timesheet_entry_id, task_id) 
  DO UPDATE SET 
    completed_at = now(),
    completed_by = COALESCE(EXCLUDED.completed_by, v_user_id)
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
-- FUNCTION: uncomplete_shift_task (Fixed)
-- Purpose: Removes a task completion - works for both admins and employees
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
-- Fix RLS for shift_task_completions table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all task completions" ON public.shift_task_completions;
DROP POLICY IF EXISTS "Employees can manage their own task completions" ON public.shift_task_completions;

-- Create permissive policy (security handled at application level)
CREATE POLICY "Allow all operations on shift_task_completions"
ON public.shift_task_completions
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;

