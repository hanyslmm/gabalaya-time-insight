-- Add organization_id to key tables for multi-tenancy
ALTER TABLE public.employees ADD COLUMN organization_id uuid REFERENCES auth.users(id);
ALTER TABLE public.timesheet_entries ADD COLUMN organization_id uuid REFERENCES auth.users(id);
ALTER TABLE public.company_settings ADD COLUMN organization_id uuid REFERENCES auth.users(id);

-- Create organizations table to manage organization metadata
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add organization metadata to admin_users for proper organization assignment
ALTER TABLE public.admin_users ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Update foreign key references to point to organizations table instead of auth.users
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_organization_id_fkey;
ALTER TABLE public.timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_organization_id_fkey;
ALTER TABLE public.company_settings DROP CONSTRAINT IF EXISTS company_settings_organization_id_fkey;

ALTER TABLE public.employees ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.timesheet_entries ADD CONSTRAINT timesheet_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

-- Create RLS policies for organizations
CREATE POLICY "Users can view their own organization" ON public.organizations
FOR SELECT USING (
  id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

CREATE POLICY "Admins can manage organizations" ON public.organizations
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'admin'
);

-- Update existing RLS policies to include organization_id filtering
DROP POLICY IF EXISTS "Admin can manage all employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employees;

CREATE POLICY "Admin can manage employees in their organization" ON public.employees
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'admin' AND 
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

CREATE POLICY "Employees can view employees in their organization" ON public.employees
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

-- Update RLS policies for timesheet_entries
DROP POLICY IF EXISTS "Admins have full access" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can update their own records" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Employees can view their own records" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.timesheet_entries;

CREATE POLICY "Admins can manage timesheet entries in their organization" ON public.timesheet_entries
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'admin' AND 
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

CREATE POLICY "Employees can view timesheet entries in their organization" ON public.timesheet_entries
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

CREATE POLICY "Employees can update their own timesheet entries" ON public.timesheet_entries
FOR UPDATE USING (
  employee_id = (SELECT id FROM public.employees WHERE staff_id = (auth.jwt() ->> 'username')) AND
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

-- Update RLS policies for company_settings
DROP POLICY IF EXISTS "Admin can manage company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;

CREATE POLICY "Admin can manage company settings in their organization" ON public.company_settings
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'admin' AND 
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

CREATE POLICY "Users can view company settings in their organization" ON public.company_settings
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'))
);

-- Create trigger to update timestamps
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default organization for migration
INSERT INTO public.organizations (id, name) VALUES (gen_random_uuid(), 'Default Organization') ON CONFLICT DO NOTHING;