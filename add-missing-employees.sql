-- Add missing employees from admin_users to employees table
-- This ensures all users who can login also appear in employee filters

INSERT INTO public.employees (staff_id, full_name, morning_wage_rate, night_wage_rate, created_at)
SELECT 
  au.username as staff_id,
  au.full_name,
  17.00 as morning_wage_rate,  -- Default morning rate
  20.00 as night_wage_rate,    -- Default night rate
  NOW() as created_at
FROM public.admin_users au
LEFT JOIN public.employees e ON e.staff_id = au.username
WHERE e.staff_id IS NULL  -- Only insert if employee doesn't already exist
  AND au.full_name IS NOT NULL
  AND au.full_name != '';

-- Specifically ensure EMP085382 (Donia Amal) exists
INSERT INTO public.employees (staff_id, full_name, morning_wage_rate, night_wage_rate, created_at)
VALUES ('EMP085382', 'Donia Amal', 17.00, 20.00, NOW())
ON CONFLICT (staff_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  updated_at = NOW();