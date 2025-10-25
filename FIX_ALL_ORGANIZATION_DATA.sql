-- ============================================================================
-- COMPREHENSIVE FIX: Assign ALL data to Science Club organization
-- This ensures marwa_user (admin) can see ALL employee data in the organization
-- ============================================================================

-- Step 1: Show current state
SELECT '=== CURRENT STATE ===' as info;
SELECT 
  au.username,
  au.role,
  au.organization_id,
  o.name as org_name
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username IN ('marwa_user', 'Maryam');

-- Step 2: Show all organizations
SELECT '=== ALL ORGANIZATIONS ===' as info;
SELECT id, name FROM organizations;

-- Step 3: Create or get Science Club organization
DO $$
DECLARE
  science_club_id UUID;
  org_count INTEGER;
BEGIN
  -- Check if Science Club exists
  SELECT id INTO science_club_id 
  FROM organizations 
  WHERE LOWER(name) = 'science club' OR name ILIKE '%science%club%'
  LIMIT 1;
  
  -- If not found, create it
  IF science_club_id IS NULL THEN
    INSERT INTO organizations (name, created_at, updated_at)
    VALUES ('Science Club', NOW(), NOW())
    RETURNING id INTO science_club_id;
    RAISE NOTICE 'Created Science Club organization: %', science_club_id;
  ELSE
    RAISE NOTICE 'Found Science Club organization: %', science_club_id;
  END IF;
  
  -- CRITICAL FIX 1: Update marwa_user to Science Club
  UPDATE admin_users
  SET 
    organization_id = science_club_id,
    current_organization_id = science_club_id,
    updated_at = NOW()
  WHERE username = 'marwa_user';
  RAISE NOTICE '✅ Updated marwa_user to Science Club';
  
  -- CRITICAL FIX 2: Update ALL admin users to Science Club if they have no org
  UPDATE admin_users
  SET 
    organization_id = science_club_id,
    current_organization_id = science_club_id,
    updated_at = NOW()
  WHERE organization_id IS NULL;
  RAISE NOTICE '✅ Updated admin users without organization';
  
  -- CRITICAL FIX 3: Update ALL employees to Science Club
  UPDATE employees
  SET 
    organization_id = science_club_id,
    updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  SELECT COUNT(*) INTO org_count FROM employees WHERE organization_id = science_club_id;
  RAISE NOTICE '✅ Updated % employees to Science Club', org_count;
  
  -- CRITICAL FIX 4: Update ALL timesheet_entries to Science Club
  UPDATE timesheet_entries
  SET 
    organization_id = science_club_id,
    updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  SELECT COUNT(*) INTO org_count FROM timesheet_entries WHERE organization_id = science_club_id;
  RAISE NOTICE '✅ Updated % timesheet entries to Science Club', org_count;
  
  -- CRITICAL FIX 5: Update wage_settings to Science Club
  UPDATE wage_settings
  SET organization_id = science_club_id
  WHERE organization_id IS NULL 
    AND id != (SELECT id FROM wage_settings ORDER BY created_at ASC LIMIT 1);
  
  -- CRITICAL FIX 6: Update company_settings to Science Club
  UPDATE company_settings
  SET organization_id = science_club_id
  WHERE organization_id IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ALL DATA ASSIGNED TO SCIENCE CLUB!';
  RAISE NOTICE '========================================';
  
END $$;

-- Step 4: Verify marwa_user has correct organization
SELECT '=== VERIFICATION: marwa_user ===' as info;
SELECT 
  au.username,
  au.role,
  o.name as organization,
  au.organization_id,
  au.current_organization_id
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

-- Step 5: Show employee counts by organization
SELECT '=== EMPLOYEE COUNTS BY ORGANIZATION ===' as info;
SELECT 
  o.name as organization,
  COUNT(DISTINCT e.id) as employee_count
FROM organizations o
LEFT JOIN employees e ON e.organization_id = o.id
GROUP BY o.name
ORDER BY o.name;

-- Step 6: Show timesheet counts by organization
SELECT '=== TIMESHEET COUNTS BY ORGANIZATION ===' as info;
SELECT 
  o.name as organization,
  COUNT(DISTINCT t.id) as timesheet_count
FROM organizations o
LEFT JOIN timesheet_entries t ON t.organization_id = o.id
GROUP BY o.name
ORDER BY o.name;

-- Step 7: Find Maryam's timesheets specifically
SELECT '=== MARYAM TIMESHEET CHECK ===' as info;
SELECT 
  t.employee_name,
  COUNT(*) as timesheet_count,
  o.name as organization
FROM timesheet_entries t
LEFT JOIN organizations o ON o.id = t.organization_id
WHERE LOWER(t.employee_name) LIKE '%maryam%'
GROUP BY t.employee_name, o.name;

-- Step 8: Ensure Maryam's timesheets are in Science Club
DO $$
DECLARE
  science_club_id UUID;
  maryam_count INTEGER;
BEGIN
  -- Get Science Club ID
  SELECT id INTO science_club_id FROM organizations WHERE name = 'Science Club' LIMIT 1;
  
  -- Update Maryam's timesheets to Science Club
  UPDATE timesheet_entries
  SET organization_id = science_club_id
  WHERE LOWER(employee_name) LIKE '%maryam%';
  
  GET DIAGNOSTICS maryam_count = ROW_COUNT;
  RAISE NOTICE '✅ Updated % Maryam timesheet entries to Science Club', maryam_count;
END $$;

-- Step 9: Final comprehensive check
SELECT '=== FINAL CHECK: Science Club Data ===' as info;
SELECT 
  'Science Club' as organization,
  (SELECT COUNT(*) FROM employees WHERE organization_id = 
    (SELECT id FROM organizations WHERE name = 'Science Club')) as employees,
  (SELECT COUNT(*) FROM timesheet_entries WHERE organization_id = 
    (SELECT id FROM organizations WHERE name = 'Science Club')) as timesheets,
  (SELECT COUNT(*) FROM admin_users WHERE organization_id = 
    (SELECT id FROM organizations WHERE name = 'Science Club')) as admins;

-- Step 10: Show sample of timesheets in Science Club
SELECT '=== SAMPLE TIMESHEETS IN SCIENCE CLUB ===' as info;
SELECT 
  t.employee_name,
  COUNT(*) as entries,
  MIN(t.clock_in_date) as first_entry,
  MAX(t.clock_in_date) as last_entry
FROM timesheet_entries t
WHERE t.organization_id = (SELECT id FROM organizations WHERE name = 'Science Club')
GROUP BY t.employee_name
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Step 11: CRITICAL - Set is_global_owner flag if missing
UPDATE admin_users
SET is_global_owner = FALSE
WHERE is_global_owner IS NULL AND role != 'owner';

SELECT '========================================' as info;
SELECT '🎉 FIX COMPLETE!' as status;
SELECT 'Next steps:' as info;
SELECT '1. LOGOUT from the application' as step1;
SELECT '2. Clear browser cache (Cmd+Shift+R)' as step2;
SELECT '3. LOGIN again as marwa_user' as step3;
SELECT '4. You should see "Science Club" in top right' as step4;
SELECT '5. You should see ALL employee timesheets' as step5;
SELECT '========================================' as info;
