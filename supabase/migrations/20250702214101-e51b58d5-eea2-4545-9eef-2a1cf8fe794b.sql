-- Add location tracking fields to timesheet_entries
ALTER TABLE public.timesheet_entries 
ADD COLUMN clock_in_location TEXT,
ADD COLUMN clock_out_location TEXT;

-- Create employee credentials by inserting into admin_users table
-- Default password will be staff_id + "123" (hashed with bcrypt in real implementation)
INSERT INTO public.admin_users (username, password_hash, full_name, role)
SELECT 
  e.staff_id,
  '$2a$10$abcdefghijklmnopqrstuvwxyz', -- This should be properly hashed in real implementation
  e.full_name,
  'employee'
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_users au WHERE au.username = e.staff_id
);

-- Update authentication context to support employee role
-- Add RLS policy for employees to access only their own timesheet data
CREATE POLICY "Employees can view their own timesheet entries" 
ON public.timesheet_entries 
FOR SELECT 
TO authenticated
USING (
  CASE 
    WHEN auth.jwt() ->> 'role' = 'admin' THEN true
    WHEN auth.jwt() ->> 'role' = 'employee' THEN employee_name = auth.jwt() ->> 'username'
    ELSE false
  END
);

-- Allow employees to insert their own timesheet entries
CREATE POLICY "Employees can insert their own timesheet entries" 
ON public.timesheet_entries 
FOR INSERT 
TO authenticated
WITH CHECK (
  CASE 
    WHEN auth.jwt() ->> 'role' = 'admin' THEN true
    WHEN auth.jwt() ->> 'role' = 'employee' THEN employee_name = auth.jwt() ->> 'username'
    ELSE false
  END
);

-- Allow employees to update their own timesheet entries
CREATE POLICY "Employees can update their own timesheet entries" 
ON public.timesheet_entries 
FOR UPDATE 
TO authenticated
USING (
  CASE 
    WHEN auth.jwt() ->> 'role' = 'admin' THEN true
    WHEN auth.jwt() ->> 'role' = 'employee' THEN employee_name = auth.jwt() ->> 'username'
    ELSE false
  END
);

-- Add employee role policy to admin_users table
CREATE POLICY "Employees can view their own profile" 
ON public.admin_users 
FOR SELECT 
TO authenticated
USING (
  CASE 
    WHEN role = 'admin' THEN true
    WHEN role = 'employee' THEN username = auth.jwt() ->> 'username'
    ELSE false
  END
);