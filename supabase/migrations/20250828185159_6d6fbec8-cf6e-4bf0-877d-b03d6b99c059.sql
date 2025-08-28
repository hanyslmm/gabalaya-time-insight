-- Add auto clock-out settings to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN auto_clockout_enabled boolean DEFAULT true,
ADD COLUMN auto_clockout_time time DEFAULT '01:00:00',
ADD COLUMN max_work_hours numeric DEFAULT 8.0,
ADD COLUMN auto_clockout_location text DEFAULT 'Auto Clock-Out';

-- Update existing record if it exists
UPDATE public.company_settings 
SET 
  auto_clockout_enabled = true,
  auto_clockout_time = '01:00:00',
  max_work_hours = 8.0,
  auto_clockout_location = 'Auto Clock-Out'
WHERE id = 1;