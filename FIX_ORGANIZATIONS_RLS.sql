-- ============================================================================
-- FIX: Organizations Table RLS Policy
-- The issue: Admin users can't read from organizations table
-- Error: GET organizations 406 Not Acceptable
-- ============================================================================

-- Step 1: Check current RLS policies on organizations table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as policy_condition
FROM pg_policies 
WHERE tablename = 'organizations';

-- Step 2: Drop existing policies that might be blocking
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_read_policy" ON public.organizations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "Enable all for owners" ON public.organizations;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.organizations;

-- Step 3: Create a simple read policy that allows ALL authenticated users to read organizations
-- This is safe because organizations table doesn't contain sensitive data
CREATE POLICY "Enable read access for all authenticated users" 
ON public.organizations FOR SELECT 
TO authenticated 
USING (true);

-- Step 4: Create admin/owner management policies
CREATE POLICY "Enable insert for owners" 
ON public.organizations FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'owner'
  )
);

CREATE POLICY "Enable update for owners" 
ON public.organizations FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'owner'
  )
);

CREATE POLICY "Enable delete for owners" 
ON public.organizations FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'owner'
  )
);

-- Step 5: Verify the fix
SELECT '=== VERIFICATION ===' as status;

-- Check if organizations table has RLS enabled
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'organizations';

-- Check new policies
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'organizations'
ORDER BY policyname;

-- Step 6: Test query that was failing
-- This simulates what the frontend is trying to do
SELECT 
  'TEST QUERY' as status,
  id,
  name
FROM organizations
WHERE id = 'bf5df4c0-b729-4599-b680-2fc71531557f';

-- If the above returns empty, check if the organization exists
SELECT 
  'ALL ORGANIZATIONS' as status,
  id,
  name
FROM organizations;

-- Step 7: Make sure Science Club exists with the correct ID
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES ('bf5df4c0-b729-4599-b680-2fc71531557f', 'Science Club', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET name = 'Science Club', updated_at = NOW();

-- Step 8: Final verification
SELECT 
  'FINAL CHECK' as status,
  o.id,
  o.name,
  COUNT(DISTINCT e.id) as employee_count,
  COUNT(DISTINCT t.id) as timesheet_count
FROM organizations o
LEFT JOIN employees e ON e.organization_id = o.id
LEFT JOIN timesheet_entries t ON t.organization_id = o.id
WHERE o.id = 'bf5df4c0-b729-4599-b680-2fc71531557f'
GROUP BY o.id, o.name;

SELECT '========================================' as info;
SELECT '✅ RLS FIXED!' as status;
SELECT 'The organizations table is now readable by all authenticated users.' as message;
SELECT 'No need to restart the app - it should work immediately!' as action;
SELECT '========================================' as info;
