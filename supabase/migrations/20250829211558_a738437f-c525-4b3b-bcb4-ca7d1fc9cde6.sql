-- Fix RLS policies for organizations and admin_users tables
-- First, fix the organizations table RLS policy to allow admin creation
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

-- Create new RLS policies for organizations
CREATE POLICY "Admins can manage all organizations" 
ON public.organizations 
FOR ALL 
USING (
  (auth.jwt() ->> 'role'::text) = 'admin'::text
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'admin'::text
);

CREATE POLICY "Users can view all organizations" 
ON public.organizations 
FOR SELECT 
USING (true);

-- Fix admin_users RLS policies to allow proper organization assignment
DROP POLICY IF EXISTS "Admin can manage admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.admin_users;

CREATE POLICY "Admins can manage all admin users" 
ON public.admin_users 
FOR ALL 
USING (
  (auth.jwt() ->> 'role'::text) = 'admin'::text
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'admin'::text
);

CREATE POLICY "Users can view their own profile" 
ON public.admin_users 
FOR SELECT 
USING (
  username = (auth.jwt() ->> 'username'::text) OR 
  (auth.jwt() ->> 'role'::text) = 'admin'::text
);

-- Update all admin users to belong to El Gabalaya organization
DO $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM public.organizations WHERE name = 'El Gabalaya';
    
    IF org_id IS NOT NULL THEN
        UPDATE public.admin_users 
        SET organization_id = org_id,
            updated_at = now()
        WHERE organization_id IS NULL;
        
        RAISE NOTICE 'Updated admin users to belong to El Gabalaya organization';
    END IF;
END $$;