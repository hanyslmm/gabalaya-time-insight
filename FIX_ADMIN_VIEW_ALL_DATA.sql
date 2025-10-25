-- FIX: Admin Can't See Other Employees' Data
-- This assigns ALL employees and timesheets to Science Club organization

-- Step 1: Get Science Club ID
DO $$
DECLARE
  science_club_id UUID;
  total_employees INTEGER;
  total_timesheets INTEGER;
  employees_updated INTEGER;
  timesheets_updated INTEGER;
BEGIN
  -- Get or create Science Club
  SELECT id INTO science_club_id FROM organizations WHERE name = 'Science Club';
  
  IF science_club_id IS NULL THEN
    INSERT INTO organizations (name, created_at, updated_at)
    VALUES ('Science Club', NOW(), NOW())
    RETURNING id INTO science_club_id;
    RAISE NOTICE 'Created Science Club organization: %', science_club_id;
  END IF;
  
  RAISE NOTICE 'Science Club ID: %', science_club_id;
  
  -- Count total records before update
  SELECT COUNT(*) INTO total_employees FROM employees;
  SELECT COUNT(*) INTO total_timesheets FROM timesheet_entries;
  
  RAISE NOTICE 'Total employees: %', total_employees;
  RAISE NOTICE 'Total timesheets: %', total_timesheets;
  
  -- Update ALL employees to Science Club (including those with NULL or different org)
  UPDATE employees
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  GET DIAGNOSTICS employees_updated = ROW_COUNT;
  RAISE NOTICE '✅ Updated % employees to Science Club', employees_updated;
  
  -- Update ALL timesheet entries to Science Club
  UPDATE timesheet_entries
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  GET DIAGNOSTICS timesheets_updated = ROW_COUNT;
  RAISE NOTICE '✅ Updated % timesheet entries to Science Club', timesheets_updated;
  
  -- Update wage_settings
  UPDATE wage_settings
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  -- Update company_settings
  UPDATE company_settings
  SET organization_id = science_club_id, updated_at = NOW()
  WHERE organization_id IS NULL OR organization_id != science_club_id;
  
  -- Make sure marwa_user has correct organization
  UPDATE admin_users
  SET 
    organization_id = science_club_id,
    current_organization_id = science_club_id,
    updated_at = NOW()
  WHERE username = 'marwa_user';
  
  RAISE NOTICE '✅ Updated marwa_user organization';
  
END $$;

-- Step 2: Verify data counts
SELECT '=== VERIFICATION ===' as section;

-- Show Science Club data counts
SELECT 
  o.name as organization,
  (SELECT COUNT(*) FROM employees WHERE organization_id = o.id) as employees,
  (SELECT COUNT(*) FROM timesheet_entries WHERE organization_id = o.id) as timesheets,
  (SELECT COUNT(*) FROM admin_users WHERE organization_id = o.id) as admins
FROM organizations o
WHERE o.name = 'Science Club';

-- Show employee list with their timesheet counts
SELECT 
  e.staff_id,
  e.full_name,
  o.name as organization,
  COUNT(t.id) as timesheet_count
FROM employees e
LEFT JOIN organizations o ON o.id = e.organization_id
LEFT JOIN timesheet_entries t ON t.employee_name = e.staff_id OR t.employee_name = e.full_name
WHERE o.name = 'Science Club'
GROUP BY e.staff_id, e.full_name, o.name
ORDER BY e.full_name;

-- Show marwa_user status
SELECT 
  'marwa_user status:' as info,
  au.username,
  au.role,
  o.name as organization,
  au.organization_id
FROM admin_users au
LEFT JOIN organizations o ON o.id = au.organization_id
WHERE au.username = 'marwa_user';

-- Show sample timesheets for verification
SELECT 
  'Sample timesheets in Science Club:' as info,
  employee_name,
  clock_in_date,
  total_hours,
  o.name as organization
FROM timesheet_entries t
LEFT JOIN organizations o ON o.id = t.organization_id
WHERE o.name = 'Science Club'
ORDER BY clock_in_date DESC
LIMIT 10;

-- Check for any orphaned data (no organization)
SELECT 
  'Employees without org:' as check,
  COUNT(*) as count
FROM employees
WHERE organization_id IS NULL;

SELECT 
  'Timesheets without org:' as check,
  COUNT(*) as count
FROM timesheet_entries
WHERE organization_id IS NULL;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Logout from application';
  RAISE NOTICE '2. Hard refresh (Cmd+Shift+R)';
  RAISE NOTICE '3. Login as marwa_user';
  RAISE NOTICE '4. Check Reports page - should show ALL employees';
  RAISE NOTICE '5. Check Timesheets page - should show ALL timesheets';
  RAISE NOTICE '========================================';
END $$;

