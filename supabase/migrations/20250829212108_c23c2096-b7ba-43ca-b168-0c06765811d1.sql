-- Simply ensure El Gabalaya exists and assign all users to it

-- Ensure El Gabalaya organization exists
INSERT INTO public.organizations (name, created_at, updated_at) 
VALUES ('El Gabalaya', now(), now())
ON CONFLICT (name) DO NOTHING;

-- If there's no unique constraint on name, we need to check first
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE name = 'El Gabalaya') THEN
        INSERT INTO public.organizations (name, created_at, updated_at) 
        VALUES ('El Gabalaya', now(), now());
    END IF;
END $$;

-- Get the El Gabalaya organization ID and assign all users to it
UPDATE public.admin_users 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE organization_id IS NULL OR organization_id != (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1);

-- Assign all employees to El Gabalaya
UPDATE public.employees 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE organization_id IS NULL OR organization_id != (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1);

-- Assign all timesheet entries to El Gabalaya
UPDATE public.timesheet_entries 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE organization_id IS NULL OR organization_id != (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1);