-- Comprehensive RLS Diagnostics and Fix
-- This will show us ALL policies and then fix them

-- Step 1: See ALL current policies on employees table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees'
ORDER BY cmd, policyname;

-- Step 2: After reviewing, run this to remove ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'employees') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON employees';
    END LOOP;
END $$;

-- Step 3: Create fresh, permissive policies for all operations
-- SELECT policy (reading)
CREATE POLICY "Enable read for authenticated users"
ON employees
FOR SELECT
TO authenticated
USING (true);

-- INSERT policy (creating)
CREATE POLICY "Enable insert for authenticated users"
ON employees
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy (editing/terminating)
CREATE POLICY "Enable update for authenticated users"
ON employees
FOR UPDATE  
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy (permanent deletion)
CREATE POLICY "Enable delete for authenticated users"
ON employees
FOR DELETE
TO authenticated
USING (true);

-- Verify the new policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees'
ORDER BY cmd, policyname;

