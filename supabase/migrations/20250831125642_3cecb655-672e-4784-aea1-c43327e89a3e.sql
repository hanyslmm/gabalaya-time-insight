-- Update existing admin and administrator accounts to owner role
UPDATE admin_users 
SET role = 'owner', is_global_owner = true
WHERE username IN ('admin', 'administrator');

-- Make sure these accounts can access all organizations
INSERT INTO owner_organization_access (owner_id, organization_id)
SELECT au.id, o.id
FROM admin_users au
CROSS JOIN organizations o
WHERE au.username IN ('admin', 'administrator')
ON CONFLICT DO NOTHING;