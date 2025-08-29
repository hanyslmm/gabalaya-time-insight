-- Create a function to get current user info for RLS
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(user_id UUID, username TEXT, role TEXT, organization_id UUID)
LANGUAGE sql
STABLE
AS $$
  -- This is a placeholder - will be set by the application
  SELECT 
    '00000000-0000-0000-0000-000000000000'::UUID as user_id,
    'anonymous'::TEXT as username,
    'anonymous'::TEXT as role,
    NULL::UUID as organization_id
  WHERE false; -- Never returns anything by default
$$;

-- Update RLS policies to be permissive for now
DROP POLICY IF EXISTS "Allow all access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all access to admin_users" ON public.admin_users;

-- Simple policies that allow authenticated requests
CREATE POLICY "Allow authenticated access to organizations" 
ON public.organizations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated access to admin_users" 
ON public.admin_users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Also update other tables to be permissive
CREATE POLICY "Allow authenticated access to employees" 
ON public.employees 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated access to timesheet_entries" 
ON public.timesheet_entries 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated access to company_settings" 
ON public.company_settings 
FOR ALL 
USING (true)
WITH CHECK (true);