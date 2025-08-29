-- Create El Gabalaya organization and assign all existing employees to it

-- Insert the new organization (use DO block to handle potential duplicates)
DO $$
DECLARE
    org_id UUID;
BEGIN
    -- Check if El Gabalaya already exists
    SELECT id INTO org_id FROM public.organizations WHERE name = 'El Gabalaya';
    
    -- If not found, create it
    IF org_id IS NULL THEN
        INSERT INTO public.organizations (name, created_at, updated_at) 
        VALUES ('El Gabalaya', now(), now())
        RETURNING id INTO org_id;
        
        RAISE NOTICE 'Created El Gabalaya organization with ID: %', org_id;
    ELSE
        RAISE NOTICE 'El Gabalaya organization already exists with ID: %', org_id;
    END IF;
    
    -- Update all employees without organization to belong to El Gabalaya
    UPDATE public.employees 
    SET organization_id = org_id,
        updated_at = now()
    WHERE organization_id IS NULL;
    
    RAISE NOTICE 'Updated employees to belong to El Gabalaya organization';
END $$;