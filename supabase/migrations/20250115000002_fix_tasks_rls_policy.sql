-- Migration: Fix Tasks RLS Policy for INSERT operations
-- Date: 2025-01-15
-- Description: Fixes RLS policy to allow admins to insert tasks in their organization
-- Version: 2.10.0

BEGIN;

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage tasks in their organization" ON public.tasks;

-- Policy for SELECT - check existing row's organization_id
CREATE POLICY "Admins can view tasks in their organization"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
);

-- Policy for UPDATE - check existing row's organization_id
CREATE POLICY "Admins can update tasks in their organization"
ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
);

-- Policy for DELETE - check existing row's organization_id
CREATE POLICY "Admins can delete tasks in their organization"
ON public.tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
);

-- Policy for INSERT - check the organization_id being inserted
CREATE POLICY "Admins can create tasks in their organization"
ON public.tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
);

COMMIT;
