-- ============================================================================
-- SAFE FIX: Donia Amal Data Inconsistency (Handles Foreign Key Constraints)
-- The issue: Donia Amal exists in both tables AND has timesheet entries
-- We can't delete from employees due to foreign key constraints
-- ============================================================================

-- Step 1: Check current state and foreign key dependencies
SELECT '=== CURRENT STATE ANALYSIS ===' as status;

-- Check Donia Amal in admin_users
SELECT 
  'ADMIN_USERS' as table_name,
  id,
  username,
  full_name,
  role,
  organization_id
FROM admin_users 
WHERE username = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Check Donia Amal in employees
SELECT 
  'EMPLOYEES' as table_name,
  id,
  staff_id,
  full_name,
  role,
  organization_id
FROM employees 
WHERE staff_id = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Check timesheet entries for Donia Amal
SELECT 
  'TIMESHEET ENTRIES' as table_name,
  COUNT(*) as entry_count,
  MIN(clock_in_date) as first_entry,
  MAX(clock_in_date) as last_entry
FROM timesheet_entries 
WHERE employee_id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Step 2: Get El Gabalaya organization ID
SELECT 
  'EL GABALAYA ORG' as status,
  id,
  name
FROM organizations 
WHERE name = 'El Gabalaya';

-- Step 3: SAFE FIX - Update both records to be consistent
-- Instead of deleting, we'll make both records consistent
DO $$
DECLARE
  el_gabalaya_org_id UUID;
  donia_amal_id UUID := 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';
  donia_amal_staff_id TEXT := 'EMP085382';
BEGIN
  -- Get El Gabalaya organization ID
  SELECT id INTO el_gabalaya_org_id 
  FROM organizations 
  WHERE name = 'El Gabalaya' 
  LIMIT 1;
  
  IF el_gabalaya_org_id IS NULL THEN
    RAISE EXCEPTION 'El Gabalaya organization not found!';
  END IF;
  
  RAISE NOTICE 'El Gabalaya organization ID: %', el_gabalaya_org_id;
  
  -- Update Donia Amal in admin_users table
  UPDATE admin_users
  SET 
    organization_id = el_gabalaya_org_id,
    current_organization_id = el_gabalaya_org_id,
    role = 'admin',
    updated_at = NOW()
  WHERE username = donia_amal_staff_id OR id = donia_amal_id;
  
  RAISE NOTICE '✅ Updated admin_users record for Donia Amal';
  
  -- Update Donia Amal in employees table (don't delete due to foreign keys)
  -- Make it consistent with admin_users
  UPDATE employees
  SET 
    organization_id = el_gabalaya_org_id,
    role = 'admin',
    updated_at = NOW()
  WHERE staff_id = donia_amal_staff_id OR id = donia_amal_id;
  
  RAISE NOTICE '✅ Updated employees record for Donia Amal (kept due to foreign keys)';
  
  -- Update all timesheet entries to use the correct organization
  UPDATE timesheet_entries
  SET 
    organization_id = el_gabalaya_org_id,
    updated_at = NOW()
  WHERE employee_id = donia_amal_id;
  
  RAISE NOTICE '✅ Updated timesheet entries for Donia Amal';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SAFE FIX COMPLETE!';
  RAISE NOTICE 'Donia Amal records are now consistent.';
  RAISE NOTICE 'Both admin_users and employees have same org/role.';
  RAISE NOTICE 'Timesheet entries updated to correct organization.';
  RAISE NOTICE '========================================';
END $$;

-- Step 4: Verify the fix
SELECT '=== VERIFICATION ===' as status;

-- Check admin_users table
SELECT 
  'ADMIN_USERS AFTER FIX' as table_name,
  id,
  username,
  full_name,
  role,
  organization_id
FROM admin_users 
WHERE username = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Check employees table
SELECT 
  'EMPLOYEES AFTER FIX' as table_name,
  id,
  staff_id,
  full_name,
  role,
  organization_id
FROM employees 
WHERE staff_id = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Check timesheet entries
SELECT 
  'TIMESHEET ENTRIES AFTER FIX' as table_name,
  COUNT(*) as entry_count,
  organization_id
FROM timesheet_entries 
WHERE employee_id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0'
GROUP BY organization_id;

-- Step 5: Show organization consistency
SELECT 
  'ORGANIZATION CONSISTENCY CHECK' as status,
  'admin_users' as table_name,
  organization_id,
  COUNT(*) as record_count
FROM admin_users 
WHERE username = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0'
GROUP BY organization_id

UNION ALL

SELECT 
  'ORGANIZATION CONSISTENCY CHECK' as status,
  'employees' as table_name,
  organization_id,
  COUNT(*) as record_count
FROM employees 
WHERE staff_id = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0'
GROUP BY organization_id;

SELECT '========================================' as info;
SELECT '✅ SAFE FIX APPLIED!' as status;
SELECT 'Both records are now consistent.' as message;
SELECT 'Try editing Donia Amal again!' as action;
SELECT '========================================' as info;
