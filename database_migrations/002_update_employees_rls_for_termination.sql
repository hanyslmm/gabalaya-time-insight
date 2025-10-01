-- Migration: Update RLS Policies to Allow Employee Termination
-- Date: 2025-09-30
-- Purpose: Allow updates to employee lifecycle fields (status, termination_date, etc.)

-- First, let's check what policies exist
-- Run this to see current policies:
-- SELECT * FROM pg_policies WHERE tablename = 'employees';

-- Drop existing UPDATE policy if it's too restrictive
DROP POLICY IF EXISTS "Users can update employees in their organization" ON employees;

-- Create a new comprehensive UPDATE policy that allows lifecycle management
CREATE POLICY "Users can update employees in their organization"
ON employees
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is updating their own organization's employees
  organization_id IN (
    SELECT organization_id FROM admin_users WHERE id = auth.uid()
    UNION
    SELECT current_organization_id FROM admin_users WHERE id = auth.uid()
  )
  OR
  -- Also allow if the employee's organization_id is being set to NULL (termination)
  organization_id IS NULL
)
WITH CHECK (
  -- Allow the update to proceed
  true
);

-- Alternative: If the above doesn't work, we can create a more permissive policy
-- This allows authenticated users to update any employee (use with caution in production)
/*
DROP POLICY IF EXISTS "Authenticated users can update employees" ON employees;
CREATE POLICY "Authenticated users can update employees"
ON employees
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
*/

COMMENT ON POLICY "Users can update employees in their organization" ON employees 
IS 'Allows users to update employees in their organization, including setting status to terminated and removing from organization';

