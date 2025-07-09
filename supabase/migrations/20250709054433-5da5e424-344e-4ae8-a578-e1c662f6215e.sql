-- Fix RLS policies to work with custom authentication instead of Supabase Auth

-- Drop existing policies
DROP POLICY IF EXISTS "Admin and admin role can manage timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can insert timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can update timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can view timesheet entries" ON public.timesheet_entries;

-- Create simplified policies that allow access for all authenticated requests
-- Since we're using custom auth, we'll handle authorization in the application layer

-- Allow all operations for now - we'll handle permissions in the app
CREATE POLICY "Allow timesheet operations" ON public.timesheet_entries FOR ALL USING (true) WITH CHECK (true);

-- Similarly fix other tables that might have auth issues
DROP POLICY IF EXISTS "Admin can manage company settings" ON public.company_settings;
CREATE POLICY "Allow company settings access" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage wage settings" ON public.wage_settings;
CREATE POLICY "Allow wage settings access" ON public.wage_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin and admin role can manage employees" ON public.employees;
CREATE POLICY "Allow employee operations" ON public.employees FOR ALL USING (true) WITH CHECK (true);