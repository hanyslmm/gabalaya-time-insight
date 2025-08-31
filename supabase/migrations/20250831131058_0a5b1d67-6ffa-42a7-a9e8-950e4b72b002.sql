-- Ensure owners have full organizational CRUD permissions
-- Update RLS policies to give owners comprehensive access

-- Drop existing restrictive policies and create comprehensive owner policies
DROP POLICY IF EXISTS "Owners can manage their organization access" ON owner_organization_access;
CREATE POLICY "Owners can manage all organization access" 
ON owner_organization_access 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.username = (auth.jwt() ->> 'username'::text) 
    AND (admin_users.role = 'owner' OR admin_users.is_global_owner = true)
  )
);

-- Update organizations policy for owners
DROP POLICY IF EXISTS "Allow authenticated access to organizations" ON organizations;
CREATE POLICY "Owners can manage all organizations" 
ON organizations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.username = (auth.jwt() ->> 'username'::text) 
    AND (admin_users.role = 'owner' OR admin_users.is_global_owner = true)
  )
);

CREATE POLICY "Admins can view their organization" 
ON organizations 
FOR SELECT 
USING (
  id = (
    SELECT admin_users.organization_id 
    FROM admin_users 
    WHERE admin_users.username = (auth.jwt() ->> 'username'::text)
    AND admin_users.role = 'admin'
  )
);

-- Update admin_users policy for owners
DROP POLICY IF EXISTS "Allow authenticated access to admin_users" ON admin_users;
CREATE POLICY "Owners can manage all admin users" 
ON admin_users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.username = (auth.jwt() ->> 'username'::text) 
    AND (au.role = 'owner' OR au.is_global_owner = true)
  )
);

CREATE POLICY "Admins can view their own record" 
ON admin_users 
FOR SELECT 
USING (username = (auth.jwt() ->> 'username'::text));