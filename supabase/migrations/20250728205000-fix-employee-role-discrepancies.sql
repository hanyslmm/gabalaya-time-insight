-- Fix employee role discrepancies
-- This migration standardizes role assignments across admin_users and employees tables
-- Date: 2025-07-28
-- Issue: Some employees showing as admin when they should be regular employees

BEGIN;

-- Step 1: Reset all employees to 'Employee' role except designated system admins
UPDATE public.employees 
SET role = 'Employee'
WHERE role = 'admin' 
  AND staff_id NOT IN ('admin', 'administrator');

-- Step 2: Ensure only designated admin accounts have admin role in employees table
UPDATE public.employees 
SET role = 'admin'
WHERE staff_id IN ('admin', 'administrator');

-- Step 3: Fix admin_users table - only system admins should have admin role
-- Note: Keep 'hany' as admin if it exists, as it was mentioned as admin account
UPDATE public.admin_users 
SET role = 'employee'
WHERE role = 'admin' 
  AND username NOT IN ('admin', 'administrator', 'hany');

-- Step 4: Specifically fix Donia Aml (EMP085382) - should be regular employee
UPDATE public.admin_users 
SET role = 'employee', full_name = 'Donia Aml'
WHERE username = 'EMP085382';

UPDATE public.employees 
SET role = 'Employee', full_name = 'Donia Aml'
WHERE staff_id = 'EMP085382';

-- Step 5: Ensure consistency between tables
-- If someone exists in admin_users as employee, they should also exist in employees table
INSERT INTO public.employees (staff_id, full_name, role, hiring_date, morning_wage_rate, night_wage_rate)
SELECT 
  au.username,
  COALESCE(au.full_name, au.username),
  'Employee',
  CURRENT_DATE,
  17.00,
  20.00
FROM public.admin_users au
LEFT JOIN public.employees e ON e.staff_id = au.username
WHERE e.staff_id IS NULL 
  AND au.role = 'employee'
  AND au.username NOT IN ('admin', 'administrator');

-- Step 6: Update existing employees table entries to match admin_users roles
UPDATE public.employees e
SET role = 'Employee'
FROM public.admin_users au
WHERE e.staff_id = au.username 
  AND au.role = 'employee'
  AND e.role != 'Employee'
  AND au.username NOT IN ('admin', 'administrator');

-- Step 7: Update constraint to ensure valid roles
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check 
  CHECK (role IN ('Champion', 'Barista', 'Host', 'Employee', 'admin'));

COMMIT;

-- Log the changes for verification
-- This will help us verify the fix worked correctly
SELECT 
  'admin_users' as source,
  username as identifier,
  full_name,
  role,
  'After fix' as status
FROM public.admin_users
WHERE username IN ('EMP085382', 'admin', 'administrator', 'hany')
UNION ALL
SELECT 
  'employees' as source,
  staff_id as identifier,
  full_name,
  role,
  'After fix' as status
FROM public.employees
WHERE staff_id IN ('EMP085382', 'admin', 'administrator', 'hany')
ORDER BY identifier, source;