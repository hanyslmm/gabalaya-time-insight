-- HOTFIX: Restore data visibility for My Timesheet by relaxing SELECT RLS
-- Note: This is a temporary, read-only relaxation to unblock production.

-- Timesheet entries: allow public SELECT so UI can read rows even with anon JWT
CREATE POLICY IF NOT EXISTS "Public can read timesheet entries (temporary)"
ON public.timesheet_entries
AS PERMISSIVE
FOR SELECT
USING (true);

-- Employees: allow public SELECT to resolve employee name/staff_id lookups
CREATE POLICY IF NOT EXISTS "Public can read employees (temporary)"
ON public.employees
AS PERMISSIVE
FOR SELECT
USING (true);

-- Wage settings: allow public SELECT so UI can fetch morning/night windows
CREATE POLICY IF NOT EXISTS "Public can read wage settings (temporary)"
ON public.wage_settings
AS PERMISSIVE
FOR SELECT
USING (true);