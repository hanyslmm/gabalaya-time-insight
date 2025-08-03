-- Verification script for employee role discrepancies
-- Run this to check the current state of roles in both tables

-- 1. Show all users in admin_users table with their roles
SELECT 
  'ADMIN_USERS TABLE' as table_name,
  username,
  full_name,
  role,
  created_at::date as created_date
FROM public.admin_users
ORDER BY role DESC, username;

-- 2. Show all employees in employees table with their roles  
SELECT 
  'EMPLOYEES TABLE' as table_name,
  staff_id as username,
  full_name,
  role,
  hiring_date as created_date
FROM public.employees
ORDER BY role DESC, staff_id;

-- 3. Find users who exist in both tables with different roles
SELECT 
  au.username,
  au.full_name as admin_users_name,
  au.role as admin_users_role,
  e.full_name as employees_name,
  e.role as employees_role,
  CASE 
    WHEN au.role != e.role THEN 'ROLE MISMATCH'
    WHEN au.full_name != e.full_name THEN 'NAME MISMATCH'
    ELSE 'CONSISTENT'
  END as status
FROM public.admin_users au
INNER JOIN public.employees e ON au.username = e.staff_id
ORDER BY status DESC, au.username;

-- 4. Find users who exist in admin_users but not in employees
SELECT 
  'MISSING FROM EMPLOYEES' as issue,
  au.username,
  au.full_name,
  au.role
FROM public.admin_users au
LEFT JOIN public.employees e ON au.username = e.staff_id
WHERE e.staff_id IS NULL;

-- 5. Find employees who exist in employees but not in admin_users
SELECT 
  'MISSING FROM ADMIN_USERS' as issue,
  e.staff_id as username,
  e.full_name,
  e.role
FROM public.employees e
LEFT JOIN public.admin_users au ON e.staff_id = au.username
WHERE au.username IS NULL;

-- 6. Show specific problematic users mentioned in the issue
SELECT 
  'SPECIFIC USERS CHECK' as check_type,
  COALESCE(au.username, e.staff_id) as username,
  COALESCE(au.full_name, e.full_name) as full_name,
  au.role as admin_users_role,
  e.role as employees_role,
  CASE 
    WHEN au.username IS NULL THEN 'Only in employees table'
    WHEN e.staff_id IS NULL THEN 'Only in admin_users table'
    WHEN au.role != e.role THEN 'Role mismatch between tables'
    ELSE 'Consistent across tables'
  END as status
FROM public.admin_users au
FULL OUTER JOIN public.employees e ON au.username = e.staff_id
WHERE COALESCE(au.username, e.staff_id) IN ('EMP085382', 'admin', 'administrator', 'hany', 'EMP117885')
ORDER BY username;

-- 7. Count of users by role in each table
SELECT 
  'ROLE SUMMARY' as summary_type,
  'admin_users' as table_name,
  role,
  COUNT(*) as user_count
FROM public.admin_users
GROUP BY role
UNION ALL
SELECT 
  'ROLE SUMMARY' as summary_type,
  'employees' as table_name,
  role,
  COUNT(*) as user_count
FROM public.employees
GROUP BY role
ORDER BY table_name, role;