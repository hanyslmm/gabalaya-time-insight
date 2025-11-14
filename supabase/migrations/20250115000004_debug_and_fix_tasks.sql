-- Migration: Debug and Fix Tasks Table RLS
-- Date: 2025-01-15
-- Description: Debug RLS issues and fix tasks table permissions
-- Version: 2.10.0

BEGIN;

-- First, let's check if RLS is enabled
DO $$
BEGIN
    RAISE NOTICE 'RLS Status for tasks table: %', 
        (SELECT CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END 
         FROM pg_class WHERE relname = 'tasks');
END $$;

-- Temporarily disable RLS to test (we'll re-enable with proper policies)
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Employees can view active tasks" ON public.tasks;

-- Re-enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create a very simple, permissive policy for testing
-- This allows any authenticated user to do anything with tasks
CREATE POLICY "Allow authenticated users full access to tasks"
ON public.tasks
FOR ALL
USING (auth.jwt() IS NOT NULL)
WITH CHECK (auth.jwt() IS NOT NULL);

-- Let's also check the admin_users table to ensure the user exists
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM public.admin_users;
    RAISE NOTICE 'Total admin users in system: %', admin_count;
END $$;

COMMIT;

-- Now let's create a more proper policy after testing
BEGIN;

-- Drop the temporary permissive policy
DROP POLICY IF EXISTS "Allow authenticated users full access to tasks" ON public.tasks;

-- Create proper policies that check admin status
-- Policy 1: Admins can do everything
CREATE POLICY "Admin users can manage tasks"
ON public.tasks
FOR ALL
USING (
    auth.jwt() IS NOT NULL 
    AND (
        auth.jwt() ->> 'role' = 'admin' 
        OR auth.jwt() ->> 'role' = 'owner'
        OR EXISTS (
            SELECT 1 FROM public.admin_users 
            WHERE username = auth.jwt() ->> 'username'
        )
    )
)
WITH CHECK (
    auth.jwt() IS NOT NULL 
    AND (
        auth.jwt() ->> 'role' = 'admin' 
        OR auth.jwt() ->> 'role' = 'owner'
        OR EXISTS (
            SELECT 1 FROM public.admin_users 
            WHERE username = auth.jwt() ->> 'username'
        )
    )
);

-- Policy 2: Employees can view active tasks
CREATE POLICY "Employees can view tasks"
ON public.tasks
FOR SELECT
USING (
    auth.jwt() IS NOT NULL 
    AND is_active = true
);

COMMIT;
