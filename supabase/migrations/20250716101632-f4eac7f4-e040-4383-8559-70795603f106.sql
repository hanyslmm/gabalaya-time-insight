-- Fix employee roles that were incorrectly set to admin
UPDATE public.employees 
SET role = 'employee' 
WHERE role = 'admin' AND staff_id NOT IN ('admin', 'administrator', 'EMP110774', 'EMP117885');

-- Ensure admin accounts have correct roles
UPDATE public.employees 
SET role = 'admin' 
WHERE staff_id IN ('admin', 'administrator', 'EMP110774', 'EMP117885');