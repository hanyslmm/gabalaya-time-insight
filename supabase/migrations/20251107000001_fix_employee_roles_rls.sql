-- Fix employee_roles RLS policy to work with service role key and anon key
-- The app uses custom auth (not Supabase Auth JWT), so we need policies that work without JWT claims

-- Drop existing policy
DROP POLICY IF EXISTS "Manage employee roles" ON public.employee_roles;

-- Create new permissive policies that work without JWT
-- Since the app uses service_role or anon key with custom auth, allow all operations
CREATE POLICY "Allow all operations on employee_roles"
ON public.employee_roles
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO service_role;

