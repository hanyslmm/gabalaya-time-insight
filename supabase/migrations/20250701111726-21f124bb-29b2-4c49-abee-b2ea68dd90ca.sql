
-- Add wage rate columns to employees table
ALTER TABLE public.employees 
ADD COLUMN morning_wage_rate NUMERIC DEFAULT 17.00,
ADD COLUMN night_wage_rate NUMERIC DEFAULT 20.00;

-- Update existing employees with default rates from wage_settings
UPDATE public.employees 
SET morning_wage_rate = (SELECT morning_wage_rate FROM public.wage_settings LIMIT 1),
    night_wage_rate = (SELECT night_wage_rate FROM public.wage_settings LIMIT 1)
WHERE morning_wage_rate IS NULL OR night_wage_rate IS NULL;
