-- Epic: Core System Refactoring - Database Security & Schema Improvements
-- 1. Enable RLS on tables that are missing it
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

-- 2. Create comprehensive RLS policies for transactions
CREATE POLICY "Admin can manage all transactions" ON public.transactions
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Employees can view company transactions" ON public.transactions
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'employee')
);

-- 3. Create RLS policies for financial_categories
CREATE POLICY "Admin can manage financial categories" ON public.financial_categories
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Authenticated users can view financial categories" ON public.financial_categories
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'employee')
);

-- 4. Improve existing RLS policies for better security
-- Replace the overly permissive policies with more specific ones

-- Update timesheet_entries policies
DROP POLICY IF EXISTS "Allow timesheet operations" ON public.timesheet_entries;

CREATE POLICY "Admin can manage all timesheet entries" ON public.timesheet_entries
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Employees can view their own timesheet entries" ON public.timesheet_entries
FOR SELECT USING (
  auth.jwt() ->> 'username' = employee_name OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Update employees policies
DROP POLICY IF EXISTS "Allow employee operations" ON public.employees;

CREATE POLICY "Admin can manage all employees" ON public.employees
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Employees can view their own profile" ON public.employees
FOR SELECT USING (
  auth.jwt() ->> 'username' = staff_id OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Update company_settings and wage_settings policies
DROP POLICY IF EXISTS "Allow company settings access" ON public.company_settings;
DROP POLICY IF EXISTS "Allow wage settings access" ON public.wage_settings;

CREATE POLICY "Admin can manage company settings" ON public.company_settings
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Authenticated users can view company settings" ON public.company_settings
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'employee')
);

CREATE POLICY "Admin can manage wage settings" ON public.wage_settings
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
) WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Authenticated users can view wage settings" ON public.wage_settings
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'employee')
);

-- 5. Create functions with proper search_path to fix linter warnings
CREATE OR REPLACE FUNCTION public.get_user_role(user_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_users WHERE username = user_username;
$$;

-- 6. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_employee_name ON public.timesheet_entries(employee_name);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_clock_in_date ON public.timesheet_entries(clock_in_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_employee_date ON public.timesheet_entries(employee_name, clock_in_date);
CREATE INDEX IF NOT EXISTS idx_employees_staff_id ON public.employees(staff_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);

-- 7. Create aggregation views for better dashboard performance
CREATE OR REPLACE VIEW public.employee_timesheet_summary AS
SELECT 
  e.staff_id,
  e.full_name,
  COUNT(t.id) as total_shifts,
  COALESCE(SUM(t.total_hours), 0) as total_hours,
  COALESCE(SUM(t.total_card_amount_flat), 0) as total_flat_amount,
  COALESCE(SUM(t.total_card_amount_split), 0) as total_split_amount,
  DATE_TRUNC('month', t.clock_in_date) as month_year
FROM public.employees e
LEFT JOIN public.timesheet_entries t ON e.staff_id = t.employee_name
GROUP BY e.staff_id, e.full_name, DATE_TRUNC('month', t.clock_in_date);

-- Apply RLS to the view
ALTER VIEW public.employee_timesheet_summary SET (security_invoker = true);