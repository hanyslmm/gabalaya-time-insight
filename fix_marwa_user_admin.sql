-- Fix: Ensure marwa_user has admin role in admin_users table

-- First, check current state
SELECT 'Current state of marwa_user:' as status;
SELECT * FROM admin_users WHERE username = 'marwa_user';

-- Get organization_id for marwa_user (assuming they're in Science Club)
DO $$
DECLARE
  org_id UUID;
  emp_id UUID;
  emp_name TEXT;
BEGIN
  -- Get organization_id from employees or organizations table
  SELECT organization_id, id, full_name INTO org_id, emp_id, emp_name
  FROM employees 
  WHERE staff_id = 'marwa_user'
  LIMIT 1;
  
  IF org_id IS NULL THEN
    -- If not found, try to get Science Club org
    SELECT id INTO org_id
    FROM organizations
    WHERE name = 'Science Club'
    LIMIT 1;
  END IF;
  
  -- Update or insert marwa_user in admin_users table with admin role
  INSERT INTO admin_users (username, password_hash, full_name, role, organization_id)
  VALUES (
    'marwa_user', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Hash for 'password' - CHANGE THIS
    COALESCE(emp_name, 'Marwa'), 
    'admin', 
    org_id
  )
  ON CONFLICT (username) DO UPDATE SET 
    role = 'admin',
    organization_id = COALESCE(EXCLUDED.organization_id, admin_users.organization_id),
    full_name = COALESCE(EXCLUDED.full_name, admin_users.full_name),
    updated_at = NOW();
  
  RAISE NOTICE 'marwa_user updated with admin role in organization: %', org_id;
END $$;

-- Verify the fix
SELECT 'After fix - marwa_user status:' as status;
SELECT username, role, organization_id, full_name, created_at, updated_at 
FROM admin_users 
WHERE username = 'marwa_user';

-- Show what organization marwa_user belongs to
SELECT 
  au.username,
  au.role,
  o.name as organization_name,
  au.organization_id
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

