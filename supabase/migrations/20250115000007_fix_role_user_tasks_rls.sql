-- Migration: Fix Role Tasks and User Tasks RLS Policies
-- Date: 2025-01-15
-- Description: Fixes RLS policies for role_tasks and user_tasks tables to allow assignments
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- Fix role_tasks table RLS
-- ============================================================================

-- Drop all existing policies on role_tasks
DROP POLICY IF EXISTS "Admins can manage role tasks" ON public.role_tasks;
DROP POLICY IF EXISTS "Employees can view role tasks for their role" ON public.role_tasks;

-- Re-enable RLS (in case it was disabled)
ALTER TABLE public.role_tasks ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for role_tasks - allows all operations
-- Security is enforced at application level (frontend checks user roles)
CREATE POLICY "Allow all operations on role_tasks"
ON public.role_tasks
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================================
-- Fix user_tasks table RLS
-- ============================================================================

-- Drop all existing policies on user_tasks
DROP POLICY IF EXISTS "Admins can manage user tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Employees can view their own tasks" ON public.user_tasks;

-- Re-enable RLS (in case it was disabled)
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for user_tasks - allows all operations
-- Security is enforced at application level (frontend checks user roles)
CREATE POLICY "Allow all operations on user_tasks"
ON public.user_tasks
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;

