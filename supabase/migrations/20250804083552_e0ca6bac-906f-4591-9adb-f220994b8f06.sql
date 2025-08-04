-- Add missing timezone column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Cairo';

-- Update existing records to have the timezone column
UPDATE public.company_settings 
SET timezone = 'Africa/Cairo' 
WHERE timezone IS NULL;

-- Insert default record if none exists
INSERT INTO public.company_settings (id, motivational_message, timezone) 
VALUES (1, 'Keep up the great work! Your dedication and effort make a real difference to our team.', 'Africa/Cairo')
ON CONFLICT (id) DO UPDATE SET
  motivational_message = COALESCE(company_settings.motivational_message, EXCLUDED.motivational_message),
  timezone = COALESCE(company_settings.timezone, EXCLUDED.timezone);