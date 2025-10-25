-- STEP 1: Add missing organization_id columns to tables that need them
-- This must run BEFORE the RLS policies migration

-- Add organization_id to employees table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.employees 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id to employees table';
  ELSE
    RAISE NOTICE 'organization_id already exists in employees table';
  END IF;
END $$;

-- Add organization_id to timesheet_entries table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'timesheet_entries' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.timesheet_entries 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id to timesheet_entries table';
  ELSE
    RAISE NOTICE 'organization_id already exists in timesheet_entries table';
  END IF;
END $$;

-- Add organization_id to wage_settings table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wage_settings' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.wage_settings 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id to wage_settings table';
  ELSE
    RAISE NOTICE 'organization_id already exists in wage_settings table';
  END IF;
END $$;

-- Add organization_id to company_settings table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'company_settings' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.company_settings 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id to company_settings table';
  ELSE
    RAISE NOTICE 'organization_id already exists in company_settings table';
  END IF;
END $$;

-- Add organization_id to admin_users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.admin_users 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id to admin_users table';
  ELSE
    RAISE NOTICE 'organization_id already exists in admin_users table';
  END IF;
END $$;

-- Add organization_id to employee_roles table if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'employee_roles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'employee_roles' 
      AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.employee_roles 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
      
      RAISE NOTICE 'Added organization_id to employee_roles table';
    ELSE
      RAISE NOTICE 'organization_id already exists in employee_roles table';
    END IF;
  ELSE
    RAISE NOTICE 'employee_roles table does not exist, skipping';
  END IF;
END $$;

-- Now populate organization_id for existing data
-- Assign all existing records to the first organization (or create one)
DO $$
DECLARE
  default_org_id UUID;
  org_count INTEGER;
BEGIN
  -- Check if organizations table has any data
  SELECT COUNT(*) INTO org_count FROM public.organizations;
  
  IF org_count = 0 THEN
    -- Create a default organization if none exists
    INSERT INTO public.organizations (name, created_at, updated_at)
    VALUES ('Default Organization', NOW(), NOW())
    RETURNING id INTO default_org_id;
    
    RAISE NOTICE 'Created default organization with ID: %', default_org_id;
  ELSE
    -- Get the first organization
    SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    
    RAISE NOTICE 'Using existing organization with ID: %', default_org_id;
  END IF;
  
  -- Update employees without organization_id
  UPDATE public.employees 
  SET organization_id = default_org_id 
  WHERE organization_id IS NULL;
  
  RAISE NOTICE 'Updated % employees with default organization_id', 
    (SELECT COUNT(*) FROM public.employees WHERE organization_id = default_org_id);
  
  -- Update timesheet_entries without organization_id
  UPDATE public.timesheet_entries 
  SET organization_id = default_org_id 
  WHERE organization_id IS NULL;
  
  RAISE NOTICE 'Updated % timesheet entries with default organization_id', 
    (SELECT COUNT(*) FROM public.timesheet_entries WHERE organization_id = default_org_id);
  
  -- Update wage_settings without organization_id (keep one NULL for global default)
  UPDATE public.wage_settings 
  SET organization_id = default_org_id 
  WHERE organization_id IS NULL 
  AND id != (SELECT id FROM public.wage_settings ORDER BY created_at ASC LIMIT 1);
  
  -- Update company_settings without organization_id
  UPDATE public.company_settings 
  SET organization_id = default_org_id 
  WHERE organization_id IS NULL;
  
  -- Update admin_users without organization_id (except global owners)
  UPDATE public.admin_users 
  SET organization_id = default_org_id 
  WHERE organization_id IS NULL 
  AND (is_global_owner IS NULL OR is_global_owner = FALSE);
  
  RAISE NOTICE 'Updated admin_users with default organization_id';
  
END $$;

-- Verify the changes
SELECT 'Organization setup complete' as status;
SELECT name, id FROM public.organizations;

SELECT 'Tables with organization_id column:' as status;
SELECT table_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'organization_id'
ORDER BY table_name;

