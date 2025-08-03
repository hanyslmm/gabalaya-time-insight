-- Add timezone support to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN timezone VARCHAR(50) DEFAULT 'Africa/Cairo';

-- Update the existing record to include Egypt timezone
UPDATE public.company_settings 
SET timezone = 'Africa/Cairo' 
WHERE id = 1;

-- Create a function to get company timezone
CREATE OR REPLACE FUNCTION get_company_timezone()
RETURNS TEXT AS $$
DECLARE
    tz TEXT;
BEGIN
    SELECT timezone INTO tz FROM public.company_settings WHERE id = 1;
    RETURN COALESCE(tz, 'Africa/Cairo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to convert UTC to company timezone
CREATE OR REPLACE FUNCTION utc_to_company_time(utc_time TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP AS $$
DECLARE
    company_tz TEXT;
BEGIN
    company_tz := get_company_timezone();
    RETURN utc_time AT TIME ZONE company_tz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to convert company time to UTC
CREATE OR REPLACE FUNCTION company_time_to_utc(local_time TIMESTAMP, company_tz TEXT DEFAULT NULL)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    IF company_tz IS NULL THEN
        company_tz := get_company_timezone();
    END IF;
    RETURN local_time AT TIME ZONE company_tz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;