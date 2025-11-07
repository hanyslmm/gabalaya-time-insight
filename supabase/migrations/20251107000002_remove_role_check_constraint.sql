-- Remove the restrictive role check constraint to allow custom roles
-- The employee_roles table now manages valid roles per organization

-- Drop the existing check constraint that limits roles to a fixed list
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- Add a more flexible constraint that just ensures role is not empty
ALTER TABLE public.employees ADD CONSTRAINT employees_role_not_empty 
  CHECK (role IS NOT NULL AND LENGTH(TRIM(role)) > 0);

-- Note: In a production system, you might want to add a foreign key constraint
-- to ensure the role exists in employee_roles for the organization, but that
-- would require more complex logic. For now, we'll allow any non-empty role.

-- Grant necessary permissions (in case they're missing)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO service_role;
