-- ============================================================================
-- COMPLETE ADMIN FULL CRUD MIGRATION - ALL IN ONE
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Add Missing organization_id Columns
-- ============================================================================

DO $$ 
BEGIN
  -- Add organization_id to employees table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    RAISE NOTICE 'Added organization_id to employees table';
  END IF;

  -- Add organization_id to timesheet_entries table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'timesheet_entries' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.timesheet_entries ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    RAISE NOTICE 'Added organization_id to timesheet_entries table';
  END IF;

  -- Add organization_id to wage_settings table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wage_settings' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.wage_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    RAISE NOTICE 'Added organization_id to wage_settings table';
  END IF;

  -- Add organization_id to company_settings table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.company_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    RAISE NOTICE 'Added organization_id to company_settings table';
  END IF;

  -- Add organization_id to admin_users table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    RAISE NOTICE 'Added organization_id to admin_users table';
  END IF;

  RAISE NOTICE '✅ PART 1 COMPLETE: organization_id columns added';
END $$;

-- Populate organization_id for existing data
DO $$
DECLARE
  default_org_id UUID;
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations;
  
  IF org_count = 0 THEN
    INSERT INTO public.organizations (name, created_at, updated_at)
    VALUES ('Default Organization', NOW(), NOW())
    RETURNING id INTO default_org_id;
    RAISE NOTICE 'Created default organization';
  ELSE
    SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    RAISE NOTICE 'Using existing organization: %', default_org_id;
  END IF;
  
  -- Update all tables with organization_id
  UPDATE public.employees SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.timesheet_entries SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.wage_settings SET organization_id = default_org_id 
    WHERE organization_id IS NULL AND id != (SELECT id FROM public.wage_settings ORDER BY created_at ASC LIMIT 1);
  UPDATE public.company_settings SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.admin_users SET organization_id = default_org_id 
    WHERE organization_id IS NULL AND (is_global_owner IS NULL OR is_global_owner = FALSE);
  
  RAISE NOTICE '✅ Populated organization_id for existing data';
END $$;

-- ============================================================================
-- PART 2: Create Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role = 'owner' OR is_global_owner = TRUE)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.admin_users 
  WHERE username = (auth.jwt() ->> 'username'::text);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role IN ('admin', 'owner') OR is_global_owner = TRUE)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DO $$ BEGIN RAISE NOTICE '✅ PART 2 COMPLETE: Helper functions created'; END $$;

-- ============================================================================
-- PART 3: Apply RLS Policies to ADMIN_USERS Table
-- ============================================================================

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

CREATE POLICY "Owners can view all users" ON public.admin_users FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view users in their org" ON public.admin_users FOR SELECT USING (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Users can view own profile" ON public.admin_users FOR SELECT USING (username = (auth.jwt() ->> 'username'::text));
CREATE POLICY "Owners can create users" ON public.admin_users FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Admins can create users in their org" ON public.admin_users FOR INSERT WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can update all users" ON public.admin_users FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update users in their org" ON public.admin_users FOR UPDATE USING (is_admin() AND organization_id = current_user_organization_id()) WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Users can update own profile" ON public.admin_users FOR UPDATE USING (username = (auth.jwt() ->> 'username'::text)) WITH CHECK (username = (auth.jwt() ->> 'username'::text));
CREATE POLICY "Owners can delete users" ON public.admin_users FOR DELETE USING (is_owner());
CREATE POLICY "Admins can delete users in their org" ON public.admin_users FOR DELETE USING (is_admin() AND organization_id = current_user_organization_id());

DO $$ BEGIN RAISE NOTICE '✅ PART 3 COMPLETE: admin_users policies applied'; END $$;

-- ============================================================================
-- PART 4: Apply RLS Policies to ORGANIZATIONS Table
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

CREATE POLICY "Owners can view all orgs" ON public.organizations FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view their org" ON public.organizations FOR SELECT USING (is_admin() AND id = current_user_organization_id());
CREATE POLICY "Owners can create orgs" ON public.organizations FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Owners can update all orgs" ON public.organizations FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update their org" ON public.organizations FOR UPDATE USING (is_admin() AND id = current_user_organization_id()) WITH CHECK (is_admin() AND id = current_user_organization_id());
CREATE POLICY "Owners can delete orgs" ON public.organizations FOR DELETE USING (is_owner());

DO $$ BEGIN RAISE NOTICE '✅ PART 4 COMPLETE: organizations policies applied'; END $$;

-- ============================================================================
-- PART 5: Apply RLS Policies to EMPLOYEES Table
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage all employees" ON public.employees;
DROP POLICY IF EXISTS "Admin and admin role can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated access to employees" ON public.employees;

CREATE POLICY "Owners can view all employees" ON public.employees FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view employees in their org" ON public.employees FOR SELECT USING (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Employees can view own profile" ON public.employees FOR SELECT USING (staff_id = (auth.jwt() ->> 'username'::text));
CREATE POLICY "Owners can create employees" ON public.employees FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Admins can create employees in their org" ON public.employees FOR INSERT WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can update all employees" ON public.employees FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update employees in their org" ON public.employees FOR UPDATE USING (is_admin() AND organization_id = current_user_organization_id()) WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can delete employees" ON public.employees FOR DELETE USING (is_owner());
CREATE POLICY "Admins can delete employees in their org" ON public.employees FOR DELETE USING (is_admin() AND organization_id = current_user_organization_id());

DO $$ BEGIN RAISE NOTICE '✅ PART 5 COMPLETE: employees policies applied'; END $$;

-- ============================================================================
-- PART 6: Apply RLS Policies to TIMESHEET_ENTRIES Table
-- ============================================================================

DROP POLICY IF EXISTS "Admin can manage all timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Admin and admin role can manage timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can view their own timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Allow authenticated access to timesheet_entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Allow timesheet operations" ON public.timesheet_entries;

CREATE POLICY "Owners can view all timesheets" ON public.timesheet_entries FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view timesheets in their org" ON public.timesheet_entries FOR SELECT USING (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Employees can view own timesheets" ON public.timesheet_entries FOR SELECT USING (employee_name = (auth.jwt() ->> 'username'::text));
CREATE POLICY "Owners can create timesheets" ON public.timesheet_entries FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Admins can create timesheets in their org" ON public.timesheet_entries FOR INSERT WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can update all timesheets" ON public.timesheet_entries FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update timesheets in their org" ON public.timesheet_entries FOR UPDATE USING (is_admin() AND organization_id = current_user_organization_id()) WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can delete timesheets" ON public.timesheet_entries FOR DELETE USING (is_owner());
CREATE POLICY "Admins can delete timesheets in their org" ON public.timesheet_entries FOR DELETE USING (is_admin() AND organization_id = current_user_organization_id());

DO $$ BEGIN RAISE NOTICE '✅ PART 6 COMPLETE: timesheet_entries policies applied'; END $$;

-- ============================================================================
-- PART 7: Apply RLS Policies to Other Tables
-- ============================================================================

-- WAGE_SETTINGS
DROP POLICY IF EXISTS "Admin can manage wage settings" ON public.wage_settings;
DROP POLICY IF EXISTS "Allow authenticated access to wage_settings" ON public.wage_settings;

CREATE POLICY "Owners can view all wage settings" ON public.wage_settings FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view wage settings in their org" ON public.wage_settings FOR SELECT USING (is_admin() AND (organization_id = current_user_organization_id() OR organization_id IS NULL));
CREATE POLICY "Users can view wage settings" ON public.wage_settings FOR SELECT USING (true);
CREATE POLICY "Owners can create wage settings" ON public.wage_settings FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Admins can create wage settings in their org" ON public.wage_settings FOR INSERT WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can update all wage settings" ON public.wage_settings FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update wage settings in their org" ON public.wage_settings FOR UPDATE USING (is_admin() AND organization_id = current_user_organization_id()) WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can delete wage settings" ON public.wage_settings FOR DELETE USING (is_owner());
CREATE POLICY "Admins can delete wage settings in their org" ON public.wage_settings FOR DELETE USING (is_admin() AND organization_id = current_user_organization_id());

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "Admin can manage company settings in their organization" ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings in their organization" ON public.company_settings;
DROP POLICY IF EXISTS "Users can view company settings in their current organization" ON public.company_settings;
DROP POLICY IF EXISTS "Allow authenticated access to company_settings" ON public.company_settings;

CREATE POLICY "Owners can view all company settings" ON public.company_settings FOR SELECT USING (is_owner());
CREATE POLICY "Admins can view company settings in their org" ON public.company_settings FOR SELECT USING (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Users can view company settings" ON public.company_settings FOR SELECT USING (organization_id = current_user_organization_id() OR organization_id::text = (auth.jwt() ->> 'organization_id'::text));
CREATE POLICY "Owners can create company settings" ON public.company_settings FOR INSERT WITH CHECK (is_owner());
CREATE POLICY "Admins can create company settings in their org" ON public.company_settings FOR INSERT WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can update all company settings" ON public.company_settings FOR UPDATE USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Admins can update company settings in their org" ON public.company_settings FOR UPDATE USING (is_admin() AND organization_id = current_user_organization_id()) WITH CHECK (is_admin() AND organization_id = current_user_organization_id());
CREATE POLICY "Owners can delete company settings" ON public.company_settings FOR DELETE USING (is_owner());
CREATE POLICY "Admins can delete company settings in their org" ON public.company_settings FOR DELETE USING (is_admin() AND organization_id = current_user_organization_id());

DO $$ BEGIN RAISE NOTICE '✅ PART 7 COMPLETE: wage_settings and company_settings policies applied'; END $$;

-- ============================================================================
-- PART 8: Fix marwa_user to be Admin
-- ============================================================================

DO $$
DECLARE
  org_id UUID;
  emp_name TEXT;
BEGIN
  -- Get organization_id from employees or first org
  SELECT organization_id, full_name INTO org_id, emp_name
  FROM employees 
  WHERE staff_id = 'marwa_user'
  LIMIT 1;
  
  IF org_id IS NULL THEN
    SELECT id INTO org_id FROM organizations LIMIT 1;
  END IF;
  
  -- Update or insert marwa_user with admin role
  INSERT INTO admin_users (username, password_hash, full_name, role, organization_id)
  VALUES (
    'marwa_user', 
    'marwa123',
    COALESCE(emp_name, 'Marwa'), 
    'admin', 
    org_id
  )
  ON CONFLICT (username) DO UPDATE SET 
    role = 'admin',
    organization_id = COALESCE(EXCLUDED.organization_id, admin_users.organization_id),
    updated_at = NOW();
  
  RAISE NOTICE '✅ PART 8 COMPLETE: marwa_user set to admin role';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$ 
DECLARE
  function_count INTEGER;
  policy_count INTEGER;
  org_count INTEGER;
BEGIN
  -- Check functions
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('is_owner', 'is_admin', 'current_user_organization_id', 'is_admin_or_owner');
  
  -- Check policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND (policyname LIKE '%Owners%' OR policyname LIKE '%Admins%');
  
  -- Check organizations
  SELECT COUNT(*) INTO org_count FROM organizations;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Helper Functions: % (expected: 4)', function_count;
  RAISE NOTICE 'RLS Policies: % (expected: >30)', policy_count;
  RAISE NOTICE 'Organizations: %', org_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Next Steps:';
  RAISE NOTICE '1. Logout from your app';
  RAISE NOTICE '2. Hard refresh (Cmd+Shift+R)';
  RAISE NOTICE '3. Login as marwa_user';
  RAISE NOTICE '4. You should see "Admin" badge';
  RAISE NOTICE '========================================';
END $$;

-- Show marwa_user status
SELECT 
  '🎯 marwa_user STATUS:' as info,
  username, 
  role, 
  organization_id,
  full_name 
FROM admin_users 
WHERE username = 'marwa_user';

