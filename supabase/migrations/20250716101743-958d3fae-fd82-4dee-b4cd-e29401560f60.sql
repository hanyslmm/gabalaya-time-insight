-- First, let's see what employees have invalid roles
SELECT staff_id, full_name, role FROM public.employees WHERE role NOT IN ('Champion', 'Barista', 'Host', 'Employee', 'admin');

-- Update the constraint to allow 'employee' role (lowercase)
ALTER TABLE public.employees DROP CONSTRAINT employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check 
CHECK (role = ANY (ARRAY['Champion'::text, 'Barista'::text, 'Host'::text, 'Employee'::text, 'employee'::text, 'admin'::text]));

-- Now fix the roles - set regular employees to 'Employee' (capital E)
UPDATE public.employees 
SET role = 'Employee' 
WHERE role NOT IN ('admin') AND staff_id NOT IN ('admin', 'administrator', 'EMP110774', 'EMP117885');

-- Ensure admin accounts have correct roles  
UPDATE public.employees 
SET role = 'admin' 
WHERE staff_id IN ('admin', 'administrator', 'EMP110774', 'EMP117885');