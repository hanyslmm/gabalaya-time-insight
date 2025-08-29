-- Move existing timesheet entries to El Gabalaya organization
DO $$
DECLARE
    org_id UUID;
BEGIN
    -- Get El Gabalaya organization ID
    SELECT id INTO org_id FROM public.organizations WHERE name = 'El Gabalaya';
    
    IF org_id IS NOT NULL THEN
        -- Update all timesheet entries without organization to belong to El Gabalaya
        UPDATE public.timesheet_entries 
        SET organization_id = org_id,
            updated_at = now()
        WHERE organization_id IS NULL;
        
        RAISE NOTICE 'Updated timesheet entries to belong to El Gabalaya organization';
    ELSE
        RAISE NOTICE 'El Gabalaya organization not found';
    END IF;
END $$;