-- Fix marwa_user Organization Assignment
-- This ensures marwa_user is properly assigned to Science Club organization

-- Step 1: Check current state
SELECT 'Current marwa_user state:' as info;
SELECT 
  au.username,
  au.role,
  au.organization_id,
  au.full_name,
  o.name as organization_name
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

-- Step 2: Check if Science Club organization exists
SELECT 'Organizations in database:' as info;
SELECT id, name FROM organizations ORDER BY name;

-- Step 3: Fix marwa_user organization assignment
DO $$
DECLARE
  science_club_id UUID;
  marwa_org_id UUID;
BEGIN
  -- Try to find Science Club organization
  SELECT id INTO science_club_id 
  FROM organizations 
  WHERE name ILIKE '%science%' OR name ILIKE '%club%'
  LIMIT 1;
  
  -- If Science Club doesn't exist, create it
  IF science_club_id IS NULL THEN
    INSERT INTO organizations (name, created_at, updated_at)
    VALUES ('Science Club', NOW(), NOW())
    RETURNING id INTO science_club_id;
    RAISE NOTICE 'Created Science Club organization: %', science_club_id;
  ELSE
    RAISE NOTICE 'Found existing Science Club organization: %', science_club_id;
  END IF;
  
  -- Update marwa_user to be in Science Club
  UPDATE admin_users
  SET 
    organization_id = science_club_id,
    current_organization_id = science_club_id,
    updated_at = NOW()
  WHERE username = 'marwa_user';
  
  RAISE NOTICE '✅ Updated marwa_user to Science Club organization';
  
  -- Also update any employees with marwa_user staff_id
  UPDATE employees
  SET organization_id = science_club_id
  WHERE staff_id = 'marwa_user' OR full_name ILIKE '%marwa%';
  
  RAISE NOTICE '✅ Updated marwa employee records';
  
  -- Assign all existing employees to Science Club if they don't have an org
  UPDATE employees
  SET organization_id = science_club_id
  WHERE organization_id IS NULL;
  
  RAISE NOTICE '✅ Assigned unassigned employees to Science Club';
  
  -- Assign all existing timesheets to Science Club if they don't have an org
  UPDATE timesheet_entries
  SET organization_id = science_club_id
  WHERE organization_id IS NULL;
  
  RAISE NOTICE '✅ Assigned unassigned timesheets to Science Club';
  
END $$;

-- Step 4: Verify the fix
SELECT '✅ VERIFICATION - marwa_user after fix:' as info;
SELECT 
  au.username,
  au.role,
  o.name as organization_name,
  au.organization_id,
  au.current_organization_id
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

-- Step 5: Check data counts for Science Club
SELECT '✅ Science Club Data Counts:' as info;
SELECT 
  o.name as organization,
  (SELECT COUNT(*) FROM employees e WHERE e.organization_id = o.id) as employees,
  (SELECT COUNT(*) FROM timesheet_entries t WHERE t.organization_id = o.id) as timesheets,
  (SELECT COUNT(*) FROM admin_users a WHERE a.organization_id = o.id) as admins
FROM organizations o
WHERE o.name ILIKE '%science%' OR o.name ILIKE '%club%';

-- Step 6: Show all organizations with their data
SELECT 
  o.name as organization,
  o.id as org_id,
  COUNT(DISTINCT e.id) as employees,
  COUNT(DISTINCT t.id) as timesheets,
  COUNT(DISTINCT a.id) as admins
FROM organizations o
LEFT JOIN employees e ON e.organization_id = o.id
LEFT JOIN timesheet_entries t ON t.organization_id = o.id
LEFT JOIN admin_users a ON a.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY o.name;

