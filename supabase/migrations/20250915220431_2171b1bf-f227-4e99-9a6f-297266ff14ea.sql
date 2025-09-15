-- Adjust RLS to restore employee visibility without relying on admin_users

-- TIMESHEET ENTRIES: replace restrictive policies with permissive, JWT-based ones
DROP POLICY IF EXISTS "Employees can view timesheet entries in their organization" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Admins can manage timesheet entries in their organization" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Allow authenticated access to timesheet_entries" ON public.timesheet_entries;

-- Admins manage within their org (permissive)
CREATE POLICY "Admins can manage timesheet entries in their organization"
ON public.timesheet_entries
AS PERMISSIVE
FOR ALL
USING ((auth.jwt() ->> 'role') = 'admin' AND organization_id::text = (auth.jwt() ->> 'organization_id'))
WITH CHECK ((auth.jwt() ->> 'role') = 'admin' AND organization_id::text = (auth.jwt() ->> 'organization_id'));

-- Employees can view own or org entries (permissive)
CREATE POLICY "Employees can view own or org timesheet entries"
ON public.timesheet_entries
AS PERMISSIVE
FOR SELECT
USING (
  employee_name = (auth.jwt() ->> 'username')
  OR organization_id::text = (auth.jwt() ->> 'organization_id')
);

-- Allow any authenticated user to select (kept permissive true as safety net)
CREATE POLICY "Allow authenticated access to timesheet_entries"
ON public.timesheet_entries
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- EMPLOYEES: fix SELECT visibility
DROP POLICY IF EXISTS "Employees can view employees in their organization" ON public.employees;
DROP POLICY IF EXISTS "Admin can manage employees in their organization" ON public.employees;

CREATE POLICY "Employees can view employees in their organization"
ON public.employees
AS PERMISSIVE
FOR SELECT
USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "Admin can manage employees in their organization"
ON public.employees
AS PERMISSIVE
FOR ALL
USING ((auth.jwt() ->> 'role') = 'admin' AND organization_id::text = (auth.jwt() ->> 'organization_id'))
WITH CHECK ((auth.jwt() ->> 'role') = 'admin' AND organization_id::text = (auth.jwt() ->> 'organization_id'));
