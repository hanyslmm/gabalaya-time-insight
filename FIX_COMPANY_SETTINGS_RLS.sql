-- Fix RLS policies for company_settings table to allow admin/owner users to insert/update
-- Run this in Supabase SQL Editor

-- First, let's check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'company_settings';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view company settings for their organization" ON company_settings;
DROP POLICY IF EXISTS "Users can update company settings for their organization" ON company_settings;
DROP POLICY IF EXISTS "Users can insert company settings for their organization" ON company_settings;

-- Create comprehensive RLS policies for company_settings
-- Policy 1: Allow users to view company settings for their organization
CREATE POLICY "Users can view company settings for their organization" ON company_settings
FOR SELECT
TO authenticated
USING (
  organization_id = (
    SELECT COALESCE(
      (auth.jwt() ->> 'current_organization_id')::uuid,
      (auth.jwt() ->> 'organization_id')::uuid
    )
  )
);

-- Policy 2: Allow admin/owner users to update company settings for their organization
CREATE POLICY "Admin/Owner users can update company settings for their organization" ON company_settings
FOR UPDATE
TO authenticated
USING (
  organization_id = (
    SELECT COALESCE(
      (auth.jwt() ->> 'current_organization_id')::uuid,
      (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  AND (auth.jwt() ->> 'role') IN ('admin', 'owner')
)
WITH CHECK (
  organization_id = (
    SELECT COALESCE(
      (auth.jwt() ->> 'current_organization_id')::uuid,
      (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  AND (auth.jwt() ->> 'role') IN ('admin', 'owner')
);

-- Policy 3: Allow admin/owner users to insert company settings for their organization
CREATE POLICY "Admin/Owner users can insert company settings for their organization" ON company_settings
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (
    SELECT COALESCE(
      (auth.jwt() ->> 'current_organization_id')::uuid,
      (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  AND (auth.jwt() ->> 'role') IN ('admin', 'owner')
);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'company_settings'
ORDER BY policyname;
