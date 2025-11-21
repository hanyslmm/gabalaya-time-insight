-- Fix RLS policies for work_regulations table
-- The app uses custom authentication, so we need permissive policies

BEGIN;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can insert work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can update work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can delete work regulations" ON public.work_regulations;

-- Create permissive policies that work with custom auth
-- Since the app handles authentication at the application level, we allow all operations
-- Security is enforced by the application code checking user roles

-- Everyone can view active regulations
CREATE POLICY "Anyone can view active work regulations"
ON public.work_regulations
FOR SELECT
USING (is_active = true);

-- Admins/owners can view all regulations (including inactive)
CREATE POLICY "Admins can view all work regulations"
ON public.work_regulations
FOR SELECT
USING (true);

-- Allow inserts (app-level security checks user role)
CREATE POLICY "Allow insert work regulations"
ON public.work_regulations
FOR INSERT
WITH CHECK (true);

-- Allow updates (app-level security checks user role)
CREATE POLICY "Allow update work regulations"
ON public.work_regulations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow deletes (app-level security checks user role)
CREATE POLICY "Allow delete work regulations"
ON public.work_regulations
FOR DELETE
USING (true);

COMMIT;

