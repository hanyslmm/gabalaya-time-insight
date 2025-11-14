-- Migration: Proper Tasks RLS Policy
-- Date: 2025-01-15
-- Description: Creates proper RLS policy that works with the app's authentication
-- Version: 2.10.0

BEGIN;

-- Re-enable RLS (in case it was disabled)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Employees can view active tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Employees can view tasks" ON public.tasks;

-- Create a policy that checks if user exists in admin_users table
-- This is the most reliable way since the app uses custom authentication
CREATE POLICY "Admin users can manage tasks"
ON public.tasks
FOR ALL
USING (
    -- Check if user exists in admin_users table (any authenticated user in admin_users)
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE username = (auth.jwt() ->> 'username'::text)
    )
)
WITH CHECK (
    -- Same check for INSERT/UPDATE
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE username = (auth.jwt() ->> 'username'::text)
    )
);

-- Employees can view active tasks in their organization
CREATE POLICY "Employees can view active tasks"
ON public.tasks
FOR SELECT
USING (
    is_active = true 
    AND (
        -- Employee in the same organization
        organization_id IN (
            SELECT organization_id FROM public.employees 
            WHERE staff_id = (auth.jwt() ->> 'username'::text)
        )
        OR
        -- Admin viewing their organization
        organization_id IN (
            SELECT current_organization_id FROM public.admin_users 
            WHERE username = (auth.jwt() ->> 'username'::text)
            UNION
            SELECT organization_id FROM public.admin_users 
            WHERE username = (auth.jwt() ->> 'username'::text)
        )
    )
);

COMMIT;

