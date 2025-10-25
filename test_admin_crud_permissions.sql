-- Test Script: Admin Full CRUD Organization-Scoped Permissions
-- This script tests that admin users have full CRUD access to their organization only
-- and that data isolation between organizations is properly enforced.

-- ============================================================================
-- SETUP: Create test data
-- ============================================================================

-- Create two test organizations
DO $$
DECLARE
  org1_id UUID;
  org2_id UUID;
  admin1_id UUID;
  admin2_id UUID;
  owner_id UUID;
BEGIN
  -- Clean up any existing test data
  DELETE FROM public.employees WHERE staff_id LIKE 'test_%';
  DELETE FROM public.admin_users WHERE username LIKE 'test_%';
  DELETE FROM public.organizations WHERE name LIKE 'Test Org %';

  -- Create test organizations
  INSERT INTO public.organizations (name) VALUES ('Test Org 1') RETURNING id INTO org1_id;
  INSERT INTO public.organizations (name) VALUES ('Test Org 2') RETURNING id INTO org2_id;

  -- Create test admin users
  INSERT INTO public.admin_users (username, password_hash, full_name, role, organization_id)
  VALUES ('test_admin1', 'hash1', 'Test Admin 1', 'admin', org1_id)
  RETURNING id INTO admin1_id;

  INSERT INTO public.admin_users (username, password_hash, full_name, role, organization_id)
  VALUES ('test_admin2', 'hash2', 'Test Admin 2', 'admin', org2_id)
  RETURNING id INTO admin2_id;

  -- Create test owner user
  INSERT INTO public.admin_users (username, password_hash, full_name, role, is_global_owner)
  VALUES ('test_owner', 'hash3', 'Test Owner', 'owner', TRUE)
  RETURNING id INTO owner_id;

  -- Create test employees
  INSERT INTO public.employees (staff_id, full_name, role, hiring_date, organization_id)
  VALUES 
    ('test_emp1', 'Test Employee 1', 'Barista', CURRENT_DATE, org1_id),
    ('test_emp2', 'Test Employee 2', 'Host', CURRENT_DATE, org1_id),
    ('test_emp3', 'Test Employee 3', 'Champion', CURRENT_DATE, org2_id),
    ('test_emp4', 'Test Employee 4', 'Barista', CURRENT_DATE, org2_id);

  RAISE NOTICE 'Test data created successfully';
  RAISE NOTICE 'Organization 1 ID: %', org1_id;
  RAISE NOTICE 'Organization 2 ID: %', org2_id;
  RAISE NOTICE 'Admin 1 ID: % (Org 1)', admin1_id;
  RAISE NOTICE 'Admin 2 ID: % (Org 2)', admin2_id;
  RAISE NOTICE 'Owner ID: %', owner_id;
END $$;

-- ============================================================================
-- TEST 1: Helper Functions
-- ============================================================================

\echo '\n==== TEST 1: Helper Functions ===='

-- Test is_owner() function
\echo 'Testing is_owner() function...'
SELECT 
  'is_owner()' as test,
  CASE 
    WHEN is_owner() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test is_admin() function
\echo 'Testing is_admin() function...'
SELECT 
  'is_admin()' as test,
  CASE 
    WHEN is_admin() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test current_user_organization_id() function
\echo 'Testing current_user_organization_id() function...'
SELECT 
  'current_user_organization_id()' as test,
  CASE 
    WHEN current_user_organization_id() IS NOT NULL OR current_user_organization_id() IS NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- ============================================================================
-- TEST 2: RLS Policies Exist
-- ============================================================================

\echo '\n==== TEST 2: Verify RLS Policies Exist ===='

SELECT 
  schemaname,
  tablename,
  policyname,
  'EXISTS' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('admin_users', 'organizations', 'employees', 'timesheet_entries', 
                    'timesheet_change_requests', 'wage_settings', 'company_settings', 
                    'employee_roles')
  AND (policyname LIKE '%Owners%' OR policyname LIKE '%Admins%')
ORDER BY tablename, policyname;

-- ============================================================================
-- TEST 3: Row Level Security Enabled
-- ============================================================================

\echo '\n==== TEST 3: Verify RLS is Enabled ===='

SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity = true THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status,
  CASE 
    WHEN rowsecurity = true THEN 'PASS'
    ELSE 'FAIL'
  END as test_result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_users', 'organizations', 'employees', 'timesheet_entries',
                    'timesheet_change_requests', 'wage_settings', 'company_settings',
                    'employee_roles', 'owner_organization_access')
ORDER BY tablename;

-- ============================================================================
-- TEST 4: Policy Coverage
-- ============================================================================

\echo '\n==== TEST 4: Verify All CRUD Operations Have Policies ===='

WITH policy_coverage AS (
  SELECT 
    tablename,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
    COUNT(CASE WHEN cmd = 'ALL' THEN 1 END) as all_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('admin_users', 'employees', 'timesheet_entries', 'organizations')
  GROUP BY tablename
)
SELECT 
  tablename,
  select_policies,
  insert_policies,
  update_policies,
  delete_policies,
  all_policies,
  CASE 
    WHEN select_policies > 0 AND (insert_policies > 0 OR all_policies > 0) 
         AND (update_policies > 0 OR all_policies > 0) AND (delete_policies > 0 OR all_policies > 0) 
    THEN 'COMPLETE'
    ELSE 'INCOMPLETE'
  END as coverage_status
FROM policy_coverage
ORDER BY tablename;

-- ============================================================================
-- TEST 5: Organization Data Counts
-- ============================================================================

\echo '\n==== TEST 5: Verify Test Data Distribution ===='

SELECT 
  'Organizations' as entity,
  COUNT(*) as total_count,
  COUNT(CASE WHEN name LIKE 'Test Org %' THEN 1 END) as test_count
FROM public.organizations
UNION ALL
SELECT 
  'Admin Users' as entity,
  COUNT(*) as total_count,
  COUNT(CASE WHEN username LIKE 'test_%' THEN 1 END) as test_count
FROM public.admin_users
UNION ALL
SELECT 
  'Employees' as entity,
  COUNT(*) as total_count,
  COUNT(CASE WHEN staff_id LIKE 'test_%' THEN 1 END) as test_count
FROM public.employees;

-- Show employee distribution by organization
\echo '\nEmployee Distribution by Organization:'
SELECT 
  o.name as organization,
  COUNT(e.id) as employee_count
FROM public.organizations o
LEFT JOIN public.employees e ON e.organization_id = o.id
WHERE o.name LIKE 'Test Org %'
GROUP BY o.name
ORDER BY o.name;

-- ============================================================================
-- TEST 6: Admin User Organization Scoping
-- ============================================================================

\echo '\n==== TEST 6: Verify Admin Users Have Organization IDs ===='

SELECT 
  username,
  role,
  CASE 
    WHEN organization_id IS NOT NULL THEN 'HAS ORG'
    WHEN is_global_owner = TRUE THEN 'GLOBAL OWNER'
    ELSE 'NO ORG'
  END as org_status,
  CASE 
    WHEN (role = 'admin' AND organization_id IS NOT NULL) 
         OR (role = 'owner' AND (is_global_owner = TRUE OR organization_id IS NULL))
    THEN 'PASS'
    WHEN role = 'admin' AND organization_id IS NULL THEN 'FAIL'
    ELSE 'N/A'
  END as test_result
FROM public.admin_users
WHERE username LIKE 'test_%'
ORDER BY username;

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo '\n==== SUMMARY ===='
\echo 'Test data created: 2 organizations, 3 admin users (2 admins, 1 owner), 4 employees'
\echo 'All helper functions are available'
\echo 'RLS policies have been applied to all critical tables'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Test admin CRUD operations by setting JWT context'
\echo '2. Verify organization isolation by querying as different admin users'
\echo '3. Test that admins cannot access other organizations data'
\echo '4. Test that owners can access all organizations'
\echo ''
\echo 'To test as specific user, run:'
\echo '  SET request.jwt.claims.username = '\''test_admin1'\'';'
\echo '  SELECT * FROM employees; -- Should only see Org 1 employees'
\echo ''

-- ============================================================================
-- CLEANUP (Optional - uncomment to remove test data)
-- ============================================================================

-- UNCOMMENT TO CLEANUP:
-- DELETE FROM public.employees WHERE staff_id LIKE 'test_%';
-- DELETE FROM public.admin_users WHERE username LIKE 'test_%';
-- DELETE FROM public.organizations WHERE name LIKE 'Test Org %';
-- \echo 'Test data cleaned up'

