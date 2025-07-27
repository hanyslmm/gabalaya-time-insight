-- Sample timesheet data for testing - UPDATED FOR CURRENT DATES
-- This script adds sample timesheet entries for the current period

-- First, let's insert some sample employees if they don't exist
INSERT INTO public.employees (staff_id, full_name, morning_wage_rate, night_wage_rate, created_at)
VALUES 
  ('emp001', 'John Doe', 17.00, 20.00, NOW()),
  ('emp002', 'Jane Smith', 17.00, 20.00, NOW()),
  ('emp003', 'om abdo', 17.00, 20.00, NOW()),
  ('emp004', 'Om Gamal', 17.00, 20.00, NOW()),
  ('EMP085382', 'Donia Amal', 17.00, 20.00, NOW())
ON CONFLICT (staff_id) DO NOTHING;

-- Insert sample timesheet entries for the CURRENT month and recent dates
INSERT INTO public.timesheet_entries (
  employee_id,
  employee_name,
  clock_in_date,
  clock_in_time,
  clock_out_date,
  clock_out_time,
  total_hours,
  morning_hours,
  night_hours,
  total_card_amount_flat,
  total_card_amount_split,
  created_at
) VALUES 
  -- Current month entries (January 2025)
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp003'),
    'om abdo',
    CURRENT_DATE - INTERVAL '5 days',
    '08:00:00',
    CURRENT_DATE - INTERVAL '5 days',
    '16:00:00',
    8.00,
    8.00,
    0.00,
    160.00,
    136.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp003'),
    'om abdo',
    CURRENT_DATE - INTERVAL '4 days',
    '09:00:00',
    CURRENT_DATE - INTERVAL '4 days',
    '17:30:00',
    8.50,
    8.50,
    0.00,
    170.00,
    144.50,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp003'),
    'om abdo',
    CURRENT_DATE - INTERVAL '3 days',
    '08:30:00',
    CURRENT_DATE - INTERVAL '3 days',
    '17:00:00',
    8.50,
    8.50,
    0.00,
    170.00,
    144.50,
    NOW()
  ),
  
  -- Om Gamal entries  
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp004'),
    'Om Gamal',
    CURRENT_DATE - INTERVAL '5 days',
    '10:00:00',
    CURRENT_DATE - INTERVAL '5 days',
    '18:00:00',
    8.00,
    7.00,
    1.00,
    160.00,
    139.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp004'),
    'Om Gamal',
    CURRENT_DATE - INTERVAL '4 days',
    '09:00:00',
    CURRENT_DATE - INTERVAL '4 days',
    '15:30:00',
    6.50,
    6.50,
    0.00,
    130.00,
    110.50,
    NOW()
  ),
  
  -- John Doe entries (night shifts)
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp001'),
    'John Doe',
    CURRENT_DATE - INTERVAL '5 days',
    '18:00:00',
    CURRENT_DATE - INTERVAL '4 days',
    '02:00:00',
    8.00,
    0.00,
    8.00,
    160.00,
    160.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp001'),
    'John Doe',
    CURRENT_DATE - INTERVAL '3 days',
    '17:30:00',
    CURRENT_DATE - INTERVAL '2 days',
    '01:30:00',
    8.00,
    0.00,
    8.00,
    160.00,
    160.00,
    NOW()
  ),
  
  -- Jane Smith entries (mixed shifts)
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp002'),
    'Jane Smith',
    CURRENT_DATE - INTERVAL '5 days',
    '14:00:00',
    CURRENT_DATE - INTERVAL '5 days',
    '22:00:00',
    8.00,
    3.00,
    5.00,
    160.00,
    151.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp002'),
    'Jane Smith',
    CURRENT_DATE - INTERVAL '2 days',
    '13:00:00',
    CURRENT_DATE - INTERVAL '2 days',
    '21:00:00',
    8.00,
    4.00,
    4.00,
    160.00,
    152.00,
    NOW()
  ),
  
  -- Donia Amal entries (the user that had issues)
  (
    (SELECT id FROM public.employees WHERE staff_id = 'EMP085382'),
    'Donia Amal',
    CURRENT_DATE - INTERVAL '6 days',
    '09:00:00',
    CURRENT_DATE - INTERVAL '6 days',
    '17:00:00',
    8.00,
    8.00,
    0.00,
    160.00,
    136.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'EMP085382'),
    'Donia Amal',
    CURRENT_DATE - INTERVAL '2 days',
    '08:30:00',
    CURRENT_DATE - INTERVAL '2 days',
    '16:30:00',
    8.00,
    8.00,
    0.00,
    160.00,
    136.00,
    NOW()
  ),
  (
    (SELECT id FROM public.employees WHERE staff_id = 'EMP085382'),
    'Donia Amal',
    CURRENT_DATE - INTERVAL '1 day',
    '10:00:00',
    CURRENT_DATE - INTERVAL '1 day',
    '18:00:00',
    8.00,
    7.00,
    1.00,
    160.00,
    139.00,
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Update the admin_users table to include sample users if they don't exist
INSERT INTO public.admin_users (username, password_hash, role, full_name, created_at)
VALUES 
  ('emp001', '$2b$10$example_hash_for_testing', 'employee', 'John Doe', NOW()),
  ('emp002', '$2b$10$example_hash_for_testing', 'employee', 'Jane Smith', NOW()),
  ('emp003', '$2b$10$example_hash_for_testing', 'employee', 'om abdo', NOW()),
  ('emp004', '$2b$10$example_hash_for_testing', 'employee', 'Om Gamal', NOW())
ON CONFLICT (username) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- Ensure wage_settings exists with default values
INSERT INTO public.wage_settings (
  morning_start_time,
  morning_end_time,
  night_start_time,
  night_end_time,
  morning_wage_rate,
  night_wage_rate,
  created_at
) VALUES (
  '06:00:00',
  '18:00:00', 
  '18:00:00',
  '06:00:00',
  17.00,
  20.00,
  NOW()
) ON CONFLICT DO NOTHING;