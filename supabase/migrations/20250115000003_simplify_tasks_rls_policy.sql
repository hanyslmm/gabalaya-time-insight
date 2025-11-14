-- Migration: Simplify Tasks RLS Policy for INSERT operations
-- Date: 2025-01-15
-- Description: Simplifies RLS policy to fix INSERT issues
-- Version: 2.10.0

BEGIN;

-- Drop all existing policies on tasks table
DROP POLICY IF EXISTS "Admins can manage tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins can update tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Admins can create tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Employees can view active tasks" ON public.tasks;

-- Create a simplified policy for admins to manage all tasks
-- This checks if the user is an admin and allows them to manage tasks
CREATE POLICY "Admins can manage all tasks"
ON public.tasks
FOR ALL
USING (
  -- Check if user is an admin
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
  )
)
WITH CHECK (
  -- For INSERT/UPDATE, just check if user is an admin
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
  )
);

-- Recreate the employee view policy
CREATE POLICY "Employees can view active tasks"
ON public.tasks
FOR SELECT
USING (
  is_active = true 
  AND organization_id IN (
    SELECT organization_id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    UNION
    SELECT current_organization_id FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
  )
);

COMMIT;
