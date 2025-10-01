-- Add working hours window configuration to wage_settings table
-- This allows organizations to enable/disable the time window limitation for payable hours

ALTER TABLE public.wage_settings 
ADD COLUMN IF NOT EXISTS working_hours_window_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS working_hours_start_time TIME NOT NULL DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS working_hours_end_time TIME NOT NULL DEFAULT '01:00:00';

-- Add comment explaining the new fields
COMMENT ON COLUMN public.wage_settings.working_hours_window_enabled IS 'Whether to limit payable hours to the working hours window';
COMMENT ON COLUMN public.wage_settings.working_hours_start_time IS 'Start time of the working hours window (e.g., 08:00:00 for 8 AM)';
COMMENT ON COLUMN public.wage_settings.working_hours_end_time IS 'End time of the working hours window (e.g., 01:00:00 for 1 AM next day)';

-- Update existing records to have the default values
UPDATE public.wage_settings 
SET 
  working_hours_window_enabled = true,
  working_hours_start_time = '08:00:00',
  working_hours_end_time = '01:00:00'
WHERE working_hours_window_enabled IS NULL;
