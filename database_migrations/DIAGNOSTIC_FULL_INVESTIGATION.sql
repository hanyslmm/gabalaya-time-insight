-- ============================================
-- COMPREHENSIVE DATABASE DIAGNOSTIC
-- Run each query ONE BY ONE to understand the issue
-- ============================================

-- ============================================
-- STEP 1: Check if employees actually exist in the database
-- ============================================
SELECT 
    id,
    staff_id,
    full_name,
    organization_id,
    status,
    created_at
FROM employees
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- STEP 2: Check ALL RLS policies on employees table
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies 
WHERE tablename = 'employees'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 3: Check if RLS is even enabled on employees table
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'employees';

-- ============================================
-- STEP 4: Check what the current authenticated user sees
-- (This simulates what the frontend query would return)
-- ============================================
SELECT 
    id,
    staff_id,
    full_name,
    organization_id,
    status
FROM employees
WHERE status = 'active'
ORDER BY created_at DESC;

-- ============================================
-- STEP 5: Check admin_users table to understand auth context
-- ============================================
SELECT 
    id,
    username,
    role,
    organization_id,
    current_organization_id
FROM admin_users
WHERE username = 'admin'
LIMIT 1;

-- ============================================
-- TEMPORARY FIX: Disable RLS to see if that's the issue
-- ============================================
-- Run this ONLY to test
-- ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable with:
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

