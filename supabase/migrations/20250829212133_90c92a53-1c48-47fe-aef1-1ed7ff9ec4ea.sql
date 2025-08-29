-- Simply assign all users and data to El Gabalaya (assuming it exists)
UPDATE public.admin_users 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1) IS NOT NULL;

-- Assign all employees to El Gabalaya
UPDATE public.employees 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1) IS NOT NULL;

-- Assign all timesheet entries to El Gabalaya
UPDATE public.timesheet_entries 
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1),
    updated_at = now()
WHERE (SELECT id FROM public.organizations WHERE name = 'El Gabalaya' LIMIT 1) IS NOT NULL;