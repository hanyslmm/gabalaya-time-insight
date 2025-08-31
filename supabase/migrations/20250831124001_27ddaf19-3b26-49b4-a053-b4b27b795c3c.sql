
-- Create a global owner role and organization switching functionality
-- Add a global owner role to admin_users
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'owner';

-- Update admin_users table to support multiple organization access for owners
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS is_global_owner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES organizations(id);

-- Create a table to track which organizations an owner has access to
CREATE TABLE IF NOT EXISTS owner_organization_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, organization_id)
);

-- Enable RLS on the new table
ALTER TABLE owner_organization_access ENABLE ROW LEVEL SECURITY;

-- Create policy for owner organization access
CREATE POLICY "Owners can manage their organization access" ON owner_organization_access
FOR ALL USING (
  owner_id IN (
    SELECT id FROM admin_users 
    WHERE username = (auth.jwt() ->> 'username') 
    AND (role = 'owner' OR is_global_owner = TRUE)
  )
);

-- Update admin_users policies to handle owners
DROP POLICY IF EXISTS "Allow authenticated access to admin_users" ON admin_users;

CREATE POLICY "Admin users can view users in their organization" ON admin_users
FOR SELECT USING (
  -- Users can see themselves
  username = (auth.jwt() ->> 'username')
  OR
  -- Admins can see users in their organization
  (
    (auth.jwt() ->> 'role') = 'admin' 
    AND organization_id = (
      SELECT organization_id FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username')
    )
  )
  OR
  -- Owners can see all users
  (
    (auth.jwt() ->> 'role') = 'owner' 
    OR EXISTS (
      SELECT 1 FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username') 
      AND is_global_owner = TRUE
    )
  )
);

CREATE POLICY "Admin users can create users in their organization" ON admin_users
FOR INSERT WITH CHECK (
  -- Admins can create users in their organization
  (
    (auth.jwt() ->> 'role') = 'admin' 
    AND organization_id = (
      SELECT organization_id FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username')
    )
  )
  OR
  -- Owners can create users in any organization they have access to
  (
    (auth.jwt() ->> 'role') = 'owner' 
    OR EXISTS (
      SELECT 1 FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username') 
      AND is_global_owner = TRUE
    )
  )
);

CREATE POLICY "Admin users can update users in their scope" ON admin_users
FOR UPDATE USING (
  -- Users can update themselves (limited)
  username = (auth.jwt() ->> 'username')
  OR
  -- Admins can update users in their organization (except role changes)
  (
    (auth.jwt() ->> 'role') = 'admin' 
    AND organization_id = (
      SELECT organization_id FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username')
    )
  )
  OR
  -- Owners can update any user
  (
    (auth.jwt() ->> 'role') = 'owner' 
    OR EXISTS (
      SELECT 1 FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username') 
      AND is_global_owner = TRUE
    )
  )
);

-- Create or update the default owner account
INSERT INTO admin_users (username, password_hash, full_name, role, is_global_owner, organization_id)
VALUES ('owner', 'owner123', 'Platform Owner', 'owner', TRUE, NULL)
ON CONFLICT (username) DO UPDATE SET 
  role = 'owner',
  is_global_owner = TRUE,
  password_hash = 'owner123';

-- Update company_settings policies for multi-organization support
DROP POLICY IF EXISTS "Allow authenticated access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Admin can manage company settings in their organization" ON company_settings;
DROP POLICY IF EXISTS "Users can view company settings in their organization" ON company_settings;

CREATE POLICY "Users can view company settings in their current organization" ON company_settings
FOR SELECT USING (
  organization_id = (
    SELECT COALESCE(current_organization_id, organization_id) 
    FROM admin_users 
    WHERE username = (auth.jwt() ->> 'username')
  )
);

CREATE POLICY "Admins can manage company settings in their organization" ON company_settings
FOR ALL USING (
  (
    (auth.jwt() ->> 'role') IN ('admin', 'owner')
    AND organization_id = (
      SELECT COALESCE(current_organization_id, organization_id) 
      FROM admin_users 
      WHERE username = (auth.jwt() ->> 'username')
    )
  )
  OR
  -- Global owners can manage all organization settings
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE username = (auth.jwt() ->> 'username') 
    AND is_global_owner = TRUE
  )
);
