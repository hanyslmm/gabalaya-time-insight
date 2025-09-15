-- HOTFIX: Relax SELECT RLS to restore visibility

-- Timesheet entries public read
CREATE POLICY "Public read timesheet entries"
ON public.timesheet_entries
AS PERMISSIVE
FOR SELECT
USING (true);

-- Employees public read
CREATE POLICY "Public read employees"
ON public.employees
AS PERMISSIVE
FOR SELECT
USING (true);

-- Wage settings public read
CREATE POLICY "Public read wage settings"
ON public.wage_settings
AS PERMISSIVE
FOR SELECT
USING (true);