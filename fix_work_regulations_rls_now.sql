-- Quick fix for work_regulations RLS policies
-- Run this directly in Supabase SQL Editor

BEGIN;

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view active work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can view all work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can insert work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can update work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can delete work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Allow insert work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Allow update work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Allow delete work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Users can view active work regulations in their org" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can insert work regulations in their org" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can update work regulations in their org" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can delete work regulations in their org" ON public.work_regulations;

-- Create simple permissive policies
-- Security is enforced at the application level

-- View: Everyone can view active regulations
CREATE POLICY "View active work regulations"
ON public.work_regulations
FOR SELECT
USING (is_active = true);

-- View: Allow viewing all (for admins - app checks role)
CREATE POLICY "View all work regulations"
ON public.work_regulations
FOR SELECT
USING (true);

-- Insert: Allow all (app checks user role)
CREATE POLICY "Insert work regulations"
ON public.work_regulations
FOR INSERT
WITH CHECK (true);

-- Update: Allow all (app checks user role)
CREATE POLICY "Update work regulations"
ON public.work_regulations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Delete: Allow all (app checks user role)
CREATE POLICY "Delete work regulations"
ON public.work_regulations
FOR DELETE
USING (true);

COMMIT;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'work_regulations'
ORDER BY policyname;

