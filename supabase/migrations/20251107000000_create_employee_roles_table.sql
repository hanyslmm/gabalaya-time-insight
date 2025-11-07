-- Create employee_roles table if it doesn't exist
-- This table stores custom employee roles scoped by organization

-- Create the table
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_roles_organization_id 
ON public.employee_roles(organization_id);

-- Enable RLS
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Manage employee roles" ON public.employee_roles;
DROP POLICY IF EXISTS "Allow all operations on employee_roles" ON public.employee_roles;

-- Create permissive policy that works with custom auth (no JWT required)
CREATE POLICY "Allow all operations on employee_roles"
ON public.employee_roles
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant permissions to all roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO service_role;

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.update_employee_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_employee_roles_updated_at ON public.employee_roles;
CREATE TRIGGER update_employee_roles_updated_at 
BEFORE UPDATE ON public.employee_roles
FOR EACH ROW 
EXECUTE FUNCTION public.update_employee_roles_updated_at();

-- Seed default roles for each organization if they don't exist
INSERT INTO public.employee_roles (organization_id, name, is_default)
SELECT o.id, d.name, true
FROM public.organizations o
CROSS JOIN (
  SELECT unnest(ARRAY['Champion','Barista','Host']) AS name
) d
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.employee_roles er 
  WHERE er.organization_id = o.id 
  AND er.name = d.name
)
ON CONFLICT (organization_id, name) DO NOTHING;

