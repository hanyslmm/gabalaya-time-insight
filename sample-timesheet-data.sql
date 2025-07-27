-- Sample timesheet data for testing
-- This script adds sample timesheet entries for the current month

-- First, let's insert some sample employees if they don't exist
INSERT INTO public.employees (staff_id, full_name, morning_wage_rate, night_wage_rate, created_at)
VALUES 
  ('emp001', 'John Doe', 17.00, 20.00, NOW()),
  ('emp002', 'Jane Smith', 17.00, 20.00, NOW()),
  ('emp003', 'om abdo', 17.00, 20.00, NOW()),
  ('emp004', 'Om Gamal', 17.00, 20.00, NOW())
ON CONFLICT (staff_id) DO NOTHING;

-- Insert sample timesheet entries for the current month
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
  -- om abdo entries
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp003'),
    'emp003',
    '2025-01-15',
    '08:00:00',
    '2025-01-15',
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
    'emp003',
    '2025-01-16',
    '09:00:00',
    '2025-01-16',
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
    'emp003',
    '2025-01-17',
    '08:30:00',
    '2025-01-17',
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
    'emp004',
    '2025-01-15',
    '10:00:00',
    '2025-01-15',
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
    'emp004',
    '2025-01-16',
    '09:00:00',
    '2025-01-16',
    '15:30:00',
    6.50,
    6.50,
    0.00,
    130.00,
    110.50,
    NOW()
  ),
  
  -- John Doe entries
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp001'),
    'emp001',
    '2025-01-15',
    '18:00:00',
    '2025-01-16',
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
    'emp001',
    '2025-01-17',
    '17:30:00',
    '2025-01-18',
    '01:30:00',
    8.00,
    0.00,
    8.00,
    160.00,
    160.00,
    NOW()
  ),
  
  -- Jane Smith entries
  (
    (SELECT id FROM public.employees WHERE staff_id = 'emp002'),
    'emp002',
    '2025-01-15',
    '14:00:00',
    '2025-01-15',
    '22:00:00',
    8.00,
    3.00,
    5.00,
    160.00,
    151.00,
    NOW()
  );

-- Update the admin_users table to include sample users if they don't exist
INSERT INTO public.admin_users (username, password_hash, role, created_at)
VALUES 
  ('emp001', '$2b$10$example_hash_for_testing', 'employee', NOW()),
  ('emp002', '$2b$10$example_hash_for_testing', 'employee', NOW()),
  ('emp003', '$2b$10$example_hash_for_testing', 'employee', NOW()),
  ('emp004', '$2b$10$example_hash_for_testing', 'employee', NOW())
ON CONFLICT (username) DO NOTHING;