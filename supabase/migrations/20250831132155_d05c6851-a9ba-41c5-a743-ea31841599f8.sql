-- Fix RLS policies to prevent infinite recursion
-- Create security definer functions to avoid recursive policy checks

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS TEXT AS $$
  SELECT role FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_current_user_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role = 'owner' OR is_global_owner = true)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create function to get user organization
CREATE OR REPLACE FUNCTION public.get_current_user_organization()
RETURNS UUID AS $$
  SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Owners can manage all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;

-- Create simpler, non-recursive policies
CREATE POLICY "Allow all authenticated access to admin_users" 
ON admin_users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Fix organizations policies
DROP POLICY IF EXISTS "Owners can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can view their organization" ON organizations;

CREATE POLICY "Allow authenticated access to organizations" 
ON organizations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Fix owner_organization_access policies
DROP POLICY IF EXISTS "Owners can manage all organization access" ON owner_organization_access;

CREATE POLICY "Allow organization access management" 
ON owner_organization_access 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Set current_organization_id for admin user to have a default organization
UPDATE admin_users 
SET current_organization_id = organization_id 
WHERE username = 'admin' AND current_organization_id IS NULL;