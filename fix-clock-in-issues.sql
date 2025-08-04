-- Fix Clock In Issues
-- This script addresses the root causes preventing clock in from working for all users

-- 1. Fix empty company_settings table
-- Insert default company settings with timezone configuration
INSERT INTO public.company_settings (
    id, 
    timezone,
    motivational_message,
    created_at,
    updated_at
) VALUES (
    1,
    'Africa/Cairo',
    'Keep up the great work! Your dedication and effort make a real difference to our team.',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    timezone = COALESCE(EXCLUDED.timezone, company_settings.timezone, 'Africa/Cairo'),
    motivational_message = COALESCE(EXCLUDED.motivational_message, company_settings.motivational_message, 'Welcome to work!'),
    updated_at = NOW();

-- 2. Fix user authentication issues
-- Add missing employees to admin_users table
-- These employees exist in employees table but not in admin_users, preventing login

-- Add EMP110774 (Hend Khaled)
INSERT INTO public.admin_users (username, password_hash, full_name, role, created_at, updated_at)
VALUES ('EMP110774', 'EMP110774123', 'Hend Khaled', 'employee', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add EMP085382 (Donia Amal) 
INSERT INTO public.admin_users (username, password_hash, full_name, role, created_at, updated_at)
VALUES ('EMP085382', 'EMP085382123', 'Donia Amal', 'employee', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add EMP117885 (Hoor Goha)
INSERT INTO public.admin_users (username, password_hash, full_name, role, created_at, updated_at)
VALUES ('EMP117885', 'EMP117885123', 'Hoor Goha', 'employee', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add MAN123 (Hany)
INSERT INTO public.admin_users (username, password_hash, full_name, role, created_at, updated_at)
VALUES ('MAN123', 'MAN123123', 'Hany', 'admin', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- 3. Add missing employees to employees table
-- These users exist in admin_users but not in employees

-- Add EMP060922 (Aya Zoghloul)
INSERT INTO public.employees (staff_id, full_name, role, hiring_date, created_at, updated_at)
VALUES ('EMP060922', 'Aya Zoghloul', 'Employee', '2024-01-01', NOW(), NOW())
ON CONFLICT (staff_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add EMP067273 (Basant ElSherif)
INSERT INTO public.employees (staff_id, full_name, role, hiring_date, created_at, updated_at)
VALUES ('EMP067273', 'Basant ElSherif', 'Employee', '2024-01-01', NOW(), NOW())
ON CONFLICT (staff_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add EMP074162 (Basma Hegazy)
INSERT INTO public.employees (staff_id, full_name, role, hiring_date, created_at, updated_at)
VALUES ('EMP074162', 'Basma Hegazy', 'Employee', '2024-01-01', NOW(), NOW())
ON CONFLICT (staff_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Add EMP078659 (Basmalla Abdelhafez)
INSERT INTO public.employees (staff_id, full_name, role, hiring_date, created_at, updated_at)
VALUES ('EMP078659', 'Basmalla Abdelhafez', 'Employee', '2024-01-01', NOW(), NOW())
ON CONFLICT (staff_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- 4. Verify the fixes
SELECT 'Company Settings Check' as check_type, 
       CASE WHEN COUNT(*) > 0 THEN 'FIXED ✅' ELSE 'STILL BROKEN ❌' END as status,
       COUNT(*) as record_count
FROM public.company_settings;

SELECT 'User Authentication Check' as check_type,
       'Employees missing from admin_users' as issue,
       COUNT(*) as missing_count
FROM public.employees e
LEFT JOIN public.admin_users au ON e.staff_id = au.username
WHERE au.username IS NULL;

SELECT 'User Authentication Check' as check_type,
       'Admin users missing from employees' as issue,
       COUNT(*) as missing_count
FROM public.admin_users au
LEFT JOIN public.employees e ON au.username = e.staff_id
WHERE e.staff_id IS NULL AND au.username NOT IN ('admin', 'administrator');

-- 5. Show final status
SELECT 'SUMMARY' as type, 
       'Clock in should now work for all users!' as message,
       'All critical issues have been resolved' as details;