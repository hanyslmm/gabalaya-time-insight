-- Add admin role to the existing admin_users table and update RLS policies
-- Update the role field to include 'admin' option (admin_users table already supports this)

-- Update employees table to include admin role option with existing roles
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN ('Champion', 'Barista', 'Host', 'Employee', 'admin'));

-- Update RLS policy for employees table to handle admin role
DROP POLICY IF EXISTS "Admin can manage employees" ON employees;

CREATE POLICY "Admin and admin role can manage employees" 
ON employees 
FOR ALL 
USING (true);

-- Update timesheet entries policies to work with admin role  
DROP POLICY IF EXISTS "Admin can manage timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Employees can view their own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Employees can insert their own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Employees can update their own timesheet entries" ON timesheet_entries;

CREATE POLICY "Admin and admin role can manage timesheet entries" 
ON timesheet_entries 
FOR ALL 
USING (
  CASE
    WHEN ((auth.jwt() ->> 'role'::text) = 'admin'::text) THEN true
    ELSE false
  END
);

CREATE POLICY "Employees can view timesheet entries" 
ON timesheet_entries 
FOR SELECT 
USING (
  CASE
    WHEN ((auth.jwt() ->> 'role'::text) = 'admin'::text) THEN true
    WHEN ((auth.jwt() ->> 'role'::text) = 'employee'::text) THEN (employee_name = (auth.jwt() ->> 'username'::text))
    ELSE false
  END
);

CREATE POLICY "Employees can insert timesheet entries" 
ON timesheet_entries 
FOR INSERT 
WITH CHECK (
  CASE
    WHEN ((auth.jwt() ->> 'role'::text) = 'admin'::text) THEN true
    WHEN ((auth.jwt() ->> 'role'::text) = 'employee'::text) THEN (employee_name = (auth.jwt() ->> 'username'::text))
    ELSE false
  END
);

CREATE POLICY "Employees can update timesheet entries" 
ON timesheet_entries 
FOR UPDATE 
USING (
  CASE
    WHEN ((auth.jwt() ->> 'role'::text) = 'admin'::text) THEN true
    WHEN ((auth.jwt() ->> 'role'::text) = 'employee'::text) THEN (employee_name = (auth.jwt() ->> 'username'::text))
    ELSE false
  END
);