-- Fix RLS policies and handle duplicate organizations

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.admin_users;

-- Create permissive RLS policies for testing
CREATE POLICY "Allow all access to organizations" 
ON public.organizations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to admin_users" 
ON public.admin_users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Handle duplicate El Gabalaya organizations
-- Keep the first one and delete duplicates
DELETE FROM public.organizations 
WHERE name = 'El Gabalaya' 
AND id NOT IN (
  SELECT id 
  FROM public.organizations 
  WHERE name = 'El Gabalaya' 
  ORDER BY created_at 
  LIMIT 1
);

-- Ensure El Gabalaya organization exists
INSERT INTO public.organizations (name, created_at, updated_at) 
VALUES ('El Gabalaya', now(), now())
ON CONFLICT DO NOTHING;

-- Use a variable approach to handle the organization assignment
DO $$
DECLARE
    gabalaya_id UUID;
BEGIN
    -- Get the single El Gabalaya organization ID
    SELECT id INTO gabalaya_id 
    FROM public.organizations 
    WHERE name = 'El Gabalaya' 
    LIMIT 1;
    
    -- Assign all admin users to El Gabalaya
    UPDATE public.admin_users 
    SET organization_id = gabalaya_id,
        updated_at = now()
    WHERE organization_id IS NULL OR organization_id != gabalaya_id;
    
    -- Assign all employees to El Gabalaya
    UPDATE public.employees 
    SET organization_id = gabalaya_id,
        updated_at = now()
    WHERE organization_id IS NULL OR organization_id != gabalaya_id;
    
    -- Assign all timesheet entries to El Gabalaya
    UPDATE public.timesheet_entries 
    SET organization_id = gabalaya_id,
        updated_at = now()
    WHERE organization_id IS NULL OR organization_id != gabalaya_id;
END $$;