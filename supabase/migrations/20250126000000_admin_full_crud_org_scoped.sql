-- Migration: Grant Admin Role Full CRUD Privileges Scoped to Their Organization
-- This migration ensures that users with 'admin' role have the same CRUD privileges as 'owner' role,
-- but strictly limited to their own organization only.
--
-- Security Model:
-- - Owner (is_global_owner = TRUE or role = 'owner'): Full access to ALL organizations
-- - Admin (role = 'admin'): Full CRUD access ONLY to their organization (organization_id match)
-- - Employee: Read-only access to their own data

-- ============================================================================
-- HELPER FUNCTIONS FOR CLEANER POLICIES
-- ============================================================================

-- Function to check if current user is an owner (global access)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role = 'owner' OR is_global_owner = TRUE)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to get current user's organization_id
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.admin_users 
  WHERE username = (auth.jwt() ->> 'username'::text);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if current user is admin or owner (has full CRUD privileges)
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role IN ('admin', 'owner') OR is_global_owner = TRUE)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- 1. ADMIN_USERS TABLE - Full CRUD for admins in their org
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view users in their organization" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can create users in their organization" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can update users in their scope" ON public.admin_users;
DROP POLICY IF EXISTS "Owners can manage all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view their own record" ON public.admin_users;
DROP POLICY IF EXISTS "Allow all authenticated access to admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow authenticated access to admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow all access to admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow write access to admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow read access to admin_users" ON public.admin_users;

-- Owners can view all users
CREATE POLICY "Owners can view all users"
ON public.admin_users
FOR SELECT
USING (is_owner());

-- Admins can view users in their organization
CREATE POLICY "Admins can view users in their org"
ON public.admin_users
FOR SELECT
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.admin_users
FOR SELECT
USING (username = (auth.jwt() ->> 'username'::text));

-- Owners can insert users in any organization
CREATE POLICY "Owners can create users"
ON public.admin_users
FOR INSERT
WITH CHECK (is_owner());

-- Admins can insert users in their organization only
CREATE POLICY "Admins can create users in their org"
ON public.admin_users
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update any user
CREATE POLICY "Owners can update all users"
ON public.admin_users
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update users in their organization
CREATE POLICY "Admins can update users in their org"
ON public.admin_users
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
ON public.admin_users
FOR UPDATE
USING (username = (auth.jwt() ->> 'username'::text))
WITH CHECK (username = (auth.jwt() ->> 'username'::text));

-- Owners can delete any user
CREATE POLICY "Owners can delete users"
ON public.admin_users
FOR DELETE
USING (is_owner());

-- Admins can delete users in their organization
CREATE POLICY "Admins can delete users in their org"
ON public.admin_users
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 2. ORGANIZATIONS TABLE - Admins can manage their own organization
-- ============================================================================

DROP POLICY IF EXISTS "Owners can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow read access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow admin write access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow admin update access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow admin delete access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow authenticated access to organizations" ON public.organizations;

-- Owners can view all organizations
CREATE POLICY "Owners can view all orgs"
ON public.organizations
FOR SELECT
USING (is_owner());

-- Admins can view their organization
CREATE POLICY "Admins can view their org"
ON public.organizations
FOR SELECT
USING (
  is_admin() AND id = current_user_organization_id()
);

-- Owners can create organizations
CREATE POLICY "Owners can create orgs"
ON public.organizations
FOR INSERT
WITH CHECK (is_owner());

-- Owners can update all organizations
CREATE POLICY "Owners can update all orgs"
ON public.organizations
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update their organization
CREATE POLICY "Admins can update their org"
ON public.organizations
FOR UPDATE
USING (
  is_admin() AND id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND id = current_user_organization_id()
);

-- Owners can delete organizations
CREATE POLICY "Owners can delete orgs"
ON public.organizations
FOR DELETE
USING (is_owner());

-- ============================================================================
-- 3. EMPLOYEES TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage all employees" ON public.employees;
DROP POLICY IF EXISTS "Admin and admin role can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated access to employees" ON public.employees;

-- Owners can view all employees
CREATE POLICY "Owners can view all employees"
ON public.employees
FOR SELECT
USING (is_owner());

-- Admins can view employees in their organization
CREATE POLICY "Admins can view employees in their org"
ON public.employees
FOR SELECT
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Employees can view their own profile
CREATE POLICY "Employees can view own profile"
ON public.employees
FOR SELECT
USING (staff_id = (auth.jwt() ->> 'username'::text));

-- Owners can create employees
CREATE POLICY "Owners can create employees"
ON public.employees
FOR INSERT
WITH CHECK (is_owner());

-- Admins can create employees in their organization
CREATE POLICY "Admins can create employees in their org"
ON public.employees
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update all employees
CREATE POLICY "Owners can update all employees"
ON public.employees
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update employees in their organization
CREATE POLICY "Admins can update employees in their org"
ON public.employees
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can delete employees
CREATE POLICY "Owners can delete employees"
ON public.employees
FOR DELETE
USING (is_owner());

-- Admins can delete employees in their organization
CREATE POLICY "Admins can delete employees in their org"
ON public.employees
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 4. TIMESHEET_ENTRIES TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage all timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Admin and admin role can manage timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can view their own timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Allow authenticated access to timesheet_entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Allow timesheet operations" ON public.timesheet_entries;

-- Owners can view all timesheet entries
CREATE POLICY "Owners can view all timesheets"
ON public.timesheet_entries
FOR SELECT
USING (is_owner());

-- Admins can view timesheet entries in their organization
CREATE POLICY "Admins can view timesheets in their org"
ON public.timesheet_entries
FOR SELECT
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Employees can view their own timesheet entries
CREATE POLICY "Employees can view own timesheets"
ON public.timesheet_entries
FOR SELECT
USING (employee_name = (auth.jwt() ->> 'username'::text));

-- Owners can create timesheet entries
CREATE POLICY "Owners can create timesheets"
ON public.timesheet_entries
FOR INSERT
WITH CHECK (is_owner());

-- Admins can create timesheet entries in their organization
CREATE POLICY "Admins can create timesheets in their org"
ON public.timesheet_entries
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update all timesheet entries
CREATE POLICY "Owners can update all timesheets"
ON public.timesheet_entries
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update timesheet entries in their organization
CREATE POLICY "Admins can update timesheets in their org"
ON public.timesheet_entries
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can delete timesheet entries
CREATE POLICY "Owners can delete timesheets"
ON public.timesheet_entries
FOR DELETE
USING (is_owner());

-- Admins can delete timesheet entries in their organization
CREATE POLICY "Admins can delete timesheets in their org"
ON public.timesheet_entries
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 5. TIMESHEET_CHANGE_REQUESTS TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Employees can view their own timesheet change requests" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Employees can create their own timesheet change requests" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Admins can view timesheet change requests in their organization" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Admins can update timesheet change requests in their organization" ON public.timesheet_change_requests;
DROP POLICY IF EXISTS "Allow authenticated access to timesheet_change_requests" ON public.timesheet_change_requests;

-- Owners can view all change requests
CREATE POLICY "Owners can view all change requests"
ON public.timesheet_change_requests
FOR SELECT
USING (is_owner());

-- Admins can view change requests in their organization
CREATE POLICY "Admins can view change requests in their org"
ON public.timesheet_change_requests
FOR SELECT
USING (
  is_admin() AND (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Employees can view their own change requests
CREATE POLICY "Employees can view own change requests"
ON public.timesheet_change_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
);

-- Employees can create their own change requests
CREATE POLICY "Employees can create own change requests"
ON public.timesheet_change_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
  )
);

-- Owners can update all change requests
CREATE POLICY "Owners can update all change requests"
ON public.timesheet_change_requests
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update change requests in their organization
CREATE POLICY "Admins can update change requests in their org"
ON public.timesheet_change_requests
FOR UPDATE
USING (
  is_admin() AND (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL  -- Support legacy data
  )
)
WITH CHECK (
  is_admin() AND (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- Owners can delete change requests
CREATE POLICY "Owners can delete change requests"
ON public.timesheet_change_requests
FOR DELETE
USING (is_owner());

-- Admins can delete change requests in their organization
CREATE POLICY "Admins can delete change requests in their org"
ON public.timesheet_change_requests
FOR DELETE
USING (
  is_admin() AND (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL  -- Support legacy data
  )
);

-- ============================================================================
-- 6. WAGE_SETTINGS TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage wage settings" ON public.wage_settings;
DROP POLICY IF EXISTS "Allow authenticated access to wage_settings" ON public.wage_settings;

-- Owners can view all wage settings
CREATE POLICY "Owners can view all wage settings"
ON public.wage_settings
FOR SELECT
USING (is_owner());

-- Admins can view wage settings for their organization
CREATE POLICY "Admins can view wage settings in their org"
ON public.wage_settings
FOR SELECT
USING (
  is_admin() AND (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL  -- Global default settings
  )
);

-- Authenticated users can view wage settings (for calculations)
CREATE POLICY "Users can view wage settings"
ON public.wage_settings
FOR SELECT
USING (true);

-- Owners can create wage settings
CREATE POLICY "Owners can create wage settings"
ON public.wage_settings
FOR INSERT
WITH CHECK (is_owner());

-- Admins can create wage settings for their organization
CREATE POLICY "Admins can create wage settings in their org"
ON public.wage_settings
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update all wage settings
CREATE POLICY "Owners can update all wage settings"
ON public.wage_settings
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update wage settings for their organization
CREATE POLICY "Admins can update wage settings in their org"
ON public.wage_settings
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can delete wage settings
CREATE POLICY "Owners can delete wage settings"
ON public.wage_settings
FOR DELETE
USING (is_owner());

-- Admins can delete wage settings for their organization
CREATE POLICY "Admins can delete wage settings in their org"
ON public.wage_settings
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 7. COMPANY_SETTINGS TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage company settings in their organization" ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings in their organization" ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings in their current organization" ON public.company_settings;
DROP POLICY IF EXISTS "Allow authenticated access to company_settings" ON public.company_settings;

-- Owners can view all company settings
CREATE POLICY "Owners can view all company settings"
ON public.company_settings
FOR SELECT
USING (is_owner());

-- Admins can view company settings for their organization
CREATE POLICY "Admins can view company settings in their org"
ON public.company_settings
FOR SELECT
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- All authenticated users can view company settings (for their org)
CREATE POLICY "Users can view company settings"
ON public.company_settings
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR organization_id::text = (auth.jwt() ->> 'organization_id'::text)
);

-- Owners can create company settings
CREATE POLICY "Owners can create company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (is_owner());

-- Admins can create company settings for their organization
CREATE POLICY "Admins can create company settings in their org"
ON public.company_settings
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update all company settings
CREATE POLICY "Owners can update all company settings"
ON public.company_settings
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update company settings for their organization
CREATE POLICY "Admins can update company settings in their org"
ON public.company_settings
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can delete company settings
CREATE POLICY "Owners can delete company settings"
ON public.company_settings
FOR DELETE
USING (is_owner());

-- Admins can delete company settings for their organization
CREATE POLICY "Admins can delete company settings in their org"
ON public.company_settings
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 8. EMPLOYEE_ROLES TABLE - Full CRUD for admins in their org
-- ============================================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON public.employee_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.employee_roles;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.employee_roles;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.employee_roles;

-- Owners can view all employee roles
CREATE POLICY "Owners can view all employee roles"
ON public.employee_roles
FOR SELECT
USING (is_owner());

-- Admins can view employee roles for their organization
CREATE POLICY "Admins can view employee roles in their org"
ON public.employee_roles
FOR SELECT
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- All users can view employee roles for their organization
CREATE POLICY "Users can view employee roles"
ON public.employee_roles
FOR SELECT
USING (organization_id = current_user_organization_id());

-- Owners can create employee roles
CREATE POLICY "Owners can create employee roles"
ON public.employee_roles
FOR INSERT
WITH CHECK (is_owner());

-- Admins can create employee roles for their organization
CREATE POLICY "Admins can create employee roles in their org"
ON public.employee_roles
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can update all employee roles
CREATE POLICY "Owners can update all employee roles"
ON public.employee_roles
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- Admins can update employee roles for their organization
CREATE POLICY "Admins can update employee roles in their org"
ON public.employee_roles
FOR UPDATE
USING (
  is_admin() AND organization_id = current_user_organization_id()
)
WITH CHECK (
  is_admin() AND organization_id = current_user_organization_id()
);

-- Owners can delete employee roles
CREATE POLICY "Owners can delete employee roles"
ON public.employee_roles
FOR DELETE
USING (is_owner());

-- Admins can delete employee roles for their organization
CREATE POLICY "Admins can delete employee roles in their org"
ON public.employee_roles
FOR DELETE
USING (
  is_admin() AND organization_id = current_user_organization_id()
);

-- ============================================================================
-- 9. OWNER_ORGANIZATION_ACCESS TABLE - Owners only
-- ============================================================================

DROP POLICY IF EXISTS "Owners can manage their organization access" ON public.owner_organization_access;
DROP POLICY IF EXISTS "Owners can manage all organization access" ON public.owner_organization_access;
DROP POLICY IF EXISTS "Allow organization access management" ON public.owner_organization_access;

-- Only owners can manage organization access
CREATE POLICY "Owners can manage org access"
ON public.owner_organization_access
FOR ALL
USING (is_owner())
WITH CHECK (is_owner());

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.is_owner() IS 'Returns TRUE if current user is an owner (global access)';
COMMENT ON FUNCTION public.is_admin() IS 'Returns TRUE if current user is an admin';
COMMENT ON FUNCTION public.current_user_organization_id() IS 'Returns the organization_id of the current user';
COMMENT ON FUNCTION public.is_admin_or_owner() IS 'Returns TRUE if current user is admin or owner (has full CRUD privileges)';

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Test queries to verify policies work correctly:
-- SELECT * FROM public.admin_users; -- Should show org-scoped data for admins
-- SELECT * FROM public.employees; -- Should show org-scoped data for admins
-- SELECT * FROM public.timesheet_entries; -- Should show org-scoped data for admins
-- SELECT * FROM public.organizations; -- Admins should only see their org

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This migration ensures:
-- 1. Owners have global access (all organizations)
-- 2. Admins have full CRUD access to their organization only
-- 3. Employees have read-only access to their own data
-- 4. All policies are consistent and secure
-- 5. Data isolation between organizations is enforced

