-- Fix timezone settings in company_settings table
-- This script ensures consistent timezone configuration for all users

-- First, check if company_settings table exists and has timezone column
DO $$
BEGIN
    -- Check if timezone column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE public.company_settings ADD COLUMN timezone VARCHAR(50) DEFAULT 'Africa/Cairo';
        RAISE NOTICE 'Added timezone column to company_settings table';
    END IF;
END $$;

-- Ensure there's exactly one company_settings record with proper timezone
INSERT INTO public.company_settings (
    id, 
    motivational_message, 
    timezone,
    created_at,
    updated_at
) VALUES (
    1,
    'Keep up the great work! Your dedication and effort make a real difference to our team.',
    'Africa/Cairo',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    timezone = COALESCE(EXCLUDED.timezone, company_settings.timezone, 'Africa/Cairo'),
    updated_at = NOW();

-- Verify the settings
SELECT 
    id,
    timezone,
    motivational_message,
    created_at,
    updated_at
FROM public.company_settings 
WHERE id = 1;

-- Show current timezone info
SELECT 
    'Current UTC Time' as label,
    NOW() as time_value
UNION ALL
SELECT 
    'Egypt Time (Africa/Cairo)' as label,
    NOW() AT TIME ZONE 'Africa/Cairo' as time_value;

-- Test timezone functions if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_company_timezone') THEN
        RAISE NOTICE 'Company timezone function result: %', get_company_timezone();
    ELSE
        RAISE NOTICE 'get_company_timezone function does not exist';
    END IF;
END $$;

RAISE NOTICE 'Timezone settings verification completed';