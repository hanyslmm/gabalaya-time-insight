-- Diagnose why admins can't see other employees' timesheets
-- This checks RLS policies and data assignment

-- 1. Check marwa_user's admin status and organization
SELECT '=== MARWA USER STATUS ===' as section;
SELECT 
  username,
  role,
  organization_id,
  current_organization_id,
  is_global_owner
FROM admin_users
WHERE username = 'marwa_user';

-- 2. Check what organization Science Club has
SELECT '=== SCIENCE CLUB ORGANIZATION ===' as section;
SELECT id, name FROM organizations WHERE name = 'Science Club';

-- 3. Check all employees in Science Club
SELECT '=== EMPLOYEES IN SCIENCE CLUB ===' as section;
SELECT 
  e.staff_id,
  e.full_name,
  e.role,
  e.organization_id,
  o.name as org_name
FROM employees e
LEFT JOIN organizations o ON o.id = e.organization_id
WHERE o.name = 'Science Club' OR e.staff_id IN ('marwa_user', 'Maryam')
ORDER BY e.full_name;

-- 4. Check timesheet entries for all Science Club employees
SELECT '=== TIMESHEET ENTRIES IN SCIENCE CLUB ===' as section;
SELECT 
  t.employee_name,
  COUNT(*) as entry_count,
  t.organization_id,
  o.name as org_name
FROM timesheet_entries t
LEFT JOIN organizations o ON o.id = t.organization_id
GROUP BY t.employee_name, t.organization_id, o.name
ORDER BY t.employee_name;

-- 5. Check if Maryam's timesheets have organization_id
SELECT '=== MARYAM TIMESHEET DETAILS ===' as section;
SELECT 
  employee_name,
  clock_in_date,
  organization_id,
  (SELECT name FROM organizations WHERE id = organization_id) as org_name
FROM timesheet_entries
WHERE employee_name ILIKE '%maryam%' OR employee_name ILIKE '%mariam%'
ORDER BY clock_in_date DESC
LIMIT 5;

-- 6. Check RLS policies on timesheet_entries
SELECT '=== RLS POLICIES ON TIMESHEET_ENTRIES ===' as section;
SELECT 
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'timesheet_entries'
AND schemaname = 'public'
ORDER BY policyname;

-- 7. Test if is_admin() function works
SELECT '=== TESTING HELPER FUNCTIONS ===' as section;
SELECT 
  'is_admin()' as function_name,
  is_admin() as result;

SELECT 
  'current_user_organization_id()' as function_name,
  current_user_organization_id() as result;

-- 8. Check if there are employees without organization_id
SELECT '=== EMPLOYEES WITHOUT ORGANIZATION ===' as section;
SELECT 
  staff_id,
  full_name,
  organization_id
FROM employees
WHERE organization_id IS NULL
LIMIT 10;

-- 9. Check if there are timesheet entries without organization_id
SELECT '=== TIMESHEETS WITHOUT ORGANIZATION ===' as section;
SELECT 
  employee_name,
  COUNT(*) as count,
  organization_id
FROM timesheet_entries
WHERE organization_id IS NULL
GROUP BY employee_name, organization_id
LIMIT 10;

