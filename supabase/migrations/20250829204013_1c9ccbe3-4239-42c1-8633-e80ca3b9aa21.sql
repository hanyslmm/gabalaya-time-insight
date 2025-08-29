-- Create El Gabalaya organization and assign all existing employees to it

-- Insert the new organization
INSERT INTO public.organizations (id, name, created_at, updated_at) 
VALUES (
  gen_random_uuid(), 
  'El Gabalaya',
  now(),
  now()
) 
ON CONFLICT (name) DO NOTHING;

-- Update all employees to belong to El Gabalaya organization
UPDATE public.employees 
SET organization_id = (
  SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1
),
updated_at = now()
WHERE organization_id IS NULL;