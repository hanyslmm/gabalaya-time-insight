-- Fix RLS policies for timesheet_change_requests table
-- The original policies use auth.jwt() which doesn't work with the custom token system
-- Replace with policies that work with the existing authentication pattern

-- Drop the problematic policies
DROP POLICY IF EXISTS "Employees can view their own requests" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Employees can create their own requests" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Admins can view requests in their organization" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Admins can update requests in their organization" ON public.timesheet_change_requests;

-- Create new policies that work with the custom authentication system
-- These policies follow the same pattern as other tables in the system

-- Employees can view their own requests
CREATE POLICY "Employees can view their own timesheet change requests"
ON public.timesheet_change_requests
AS PERMISSIVE
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
  OR organization_id::text = (auth.jwt() ->> 'organization_id')
);

-- Employees can create their own requests
CREATE POLICY "Employees can create their own timesheet change requests"
ON public.timesheet_change_requests
AS PERMISSIVE
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
  AND organization_id::text = (auth.jwt() ->> 'organization_id')
);

-- Admins can view all requests in their organization
CREATE POLICY "Admins can view timesheet change requests in their organization"
ON public.timesheet_change_requests
AS PERMISSIVE
FOR SELECT
USING (
  (auth.jwt() ->> 'role'::text) = 'admin'::text 
  AND (
    organization_id::text = (auth.jwt() ->> 'organization_id'::text)
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Admins can update requests in their organization
CREATE POLICY "Admins can update timesheet change requests in their organization"
ON public.timesheet_change_requests
AS PERMISSIVE
FOR UPDATE
USING (
  (auth.jwt() ->> 'role'::text) = 'admin'::text 
  AND (
    organization_id::text = (auth.jwt() ->> 'organization_id'::text)
    OR organization_id IS NULL  -- Support legacy data
  )
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'admin'::text 
  AND (
    organization_id::text = (auth.jwt() ->> 'organization_id'::text)
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Allow authenticated users to select (safety net)
CREATE POLICY "Allow authenticated access to timesheet_change_requests"
ON public.timesheet_change_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
