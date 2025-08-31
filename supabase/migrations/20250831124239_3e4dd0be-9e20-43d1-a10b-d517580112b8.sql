-- Add missing columns to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS is_global_owner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES organizations(id);

-- Create the owner_organization_access table if it doesn't exist
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

-- Create or update the default owner account
INSERT INTO admin_users (username, password_hash, full_name, role, is_global_owner, organization_id)
VALUES ('owner', 'owner123', 'Platform Owner', 'owner', TRUE, NULL)
ON CONFLICT (username) DO UPDATE SET 
  role = 'owner',
  is_global_owner = TRUE,
  password_hash = 'owner123';