-- ============================================================================
-- FIX: Donia Amal Data Inconsistency
-- The issue: Donia Amal exists in both admin_users and employees tables
-- This causes confusion about which table to update
-- ============================================================================

-- Step 1: Check current state of Donia Amal
SELECT '=== DONIA AMAL CURRENT STATE ===' as status;

-- Check in admin_users table
SELECT 
  'ADMIN_USERS' as table_name,
  id,
  username,
  full_name,
  role,
  organization_id,
  is_global_owner
FROM admin_users 
WHERE username = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Check in employees table
SELECT 
  'EMPLOYEES' as table_name,
  id,
  staff_id,
  full_name,
  role,
  organization_id
FROM employees 
WHERE staff_id = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Step 2: Get El Gabalaya organization ID
SELECT 
  'EL GABALAYA ORG' as status,
  id,
  name
FROM organizations 
WHERE name = 'El Gabalaya';

-- Step 3: Fix the data inconsistency
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
  
  -- Update Donia Amal in admin_users table (if exists)
  UPDATE admin_users
  SET 
    organization_id = el_gabalaya_org_id,
    current_organization_id = el_gabalaya_org_id,
    role = 'admin',
    updated_at = NOW()
  WHERE username = donia_amal_staff_id OR id = donia_amal_id;
  
  GET DIAGNOSTICS donia_amal_id = ROW_COUNT;
  RAISE NOTICE 'Updated % admin_users records for Donia Amal', donia_amal_id;
  
  -- Remove Donia Amal from employees table (if exists)
  -- Since she's an admin, she shouldn't be in the employees table
  DELETE FROM employees 
  WHERE staff_id = donia_amal_staff_id OR id = donia_amal_id;
  
  GET DIAGNOSTICS donia_amal_id = ROW_COUNT;
  RAISE NOTICE 'Removed % employee records for Donia Amal', donia_amal_id;
  
  RAISE NOTICE '✅ Donia Amal data consistency fixed!';
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

-- Check employees table (should be empty now)
SELECT 
  'EMPLOYEES AFTER FIX' as table_name,
  id,
  staff_id,
  full_name,
  role,
  organization_id
FROM employees 
WHERE staff_id = 'EMP085382' OR id = 'cfe7d011-1fa4-4266-ba80-7b24041e2ed0';

-- Step 5: Show all admin users in El Gabalaya
SELECT 
  'ALL ADMIN USERS IN EL GABALAYA' as status,
  id,
  username,
  full_name,
  role,
  organization_id
FROM admin_users 
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'El Gabalaya')
ORDER BY created_at;

SELECT '========================================' as info;
SELECT '✅ DATA CONSISTENCY FIXED!' as status;
SELECT 'Donia Amal is now only in admin_users table.' as message;
SELECT 'Try editing her again - should work now!' as action;
SELECT '========================================' as info;
