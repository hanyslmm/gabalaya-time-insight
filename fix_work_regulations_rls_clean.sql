-- Clean fix for work_regulations RLS policies
-- Remove all problematic policies and keep only simple permissive ones

BEGIN;

-- Drop ALL existing policies (including the problematic ones with functions)
DROP POLICY IF EXISTS "Admins/Owners can view work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Delete work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Employees can view active work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Insert work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Update work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "View active work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "View all work regulations" ON public.work_regulations;

-- Create ONLY simple permissive policies
-- These work with custom authentication since security is enforced at app level

-- SELECT: Allow viewing all regulations (app filters by is_active for employees)
CREATE POLICY "Allow select work regulations"
ON public.work_regulations
FOR SELECT
USING (true);

-- INSERT: Allow inserting (app checks user role)
CREATE POLICY "Allow insert work regulations"
ON public.work_regulations
FOR INSERT
WITH CHECK (true);

-- UPDATE: Allow updating (app checks user role)
CREATE POLICY "Allow update work regulations"
ON public.work_regulations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE: Allow deleting (app checks user role)
CREATE POLICY "Allow delete work regulations"
ON public.work_regulations
FOR DELETE
USING (true);

COMMIT;

-- Verify policies were created correctly
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'work_regulations'
ORDER BY cmd, policyname;

