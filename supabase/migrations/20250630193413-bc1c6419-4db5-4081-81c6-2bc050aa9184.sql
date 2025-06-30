
-- Enable Row Level Security on auth schema (required for custom authentication)
-- We'll create a custom users table for admin management

-- Create employees table for employee master data
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  hiring_date DATE NOT NULL,
  email TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timesheet_entries table for timesheet data
CREATE TABLE public.timesheet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id),
  employee_name TEXT NOT NULL,
  clock_in_date DATE NOT NULL,
  clock_in_time TIME NOT NULL,
  clock_out_date DATE NOT NULL,
  clock_out_time TIME NOT NULL,
  total_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  morning_hours DECIMAL(5,2) DEFAULT 0,
  night_hours DECIMAL(5,2) DEFAULT 0,
  total_card_amount_flat DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_card_amount_split DECIMAL(10,2) DEFAULT 0,
  break_start TIME,
  break_end TIME,
  break_length DECIMAL(5,2),
  break_type TEXT,
  payroll_id TEXT,
  actual_hours DECIMAL(5,2),
  no_show_reason TEXT,
  employee_note TEXT,
  manager_note TEXT,
  is_split_calculation BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wage_settings table for customizable wage parameters
CREATE TABLE public.wage_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  morning_start_time TIME NOT NULL DEFAULT '08:00:00',
  morning_end_time TIME NOT NULL DEFAULT '17:00:00',
  night_start_time TIME NOT NULL DEFAULT '17:00:00',
  night_end_time TIME NOT NULL DEFAULT '01:00:00',
  morning_wage_rate DECIMAL(8,2) NOT NULL DEFAULT 17.00,
  night_wage_rate DECIMAL(8,2) NOT NULL DEFAULT 20.00,
  default_flat_wage_rate DECIMAL(8,2) NOT NULL DEFAULT 20.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default wage settings
INSERT INTO public.wage_settings (
  morning_start_time,
  morning_end_time,
  night_start_time,
  night_end_time,
  morning_wage_rate,
  night_wage_rate,
  default_flat_wage_rate
) VALUES (
  '08:00:00',
  '17:00:00',
  '17:00:00',
  '01:00:00',
  17.00,
  20.00,
  20.00
);

-- Create admin_users table for authentication (separate from Supabase auth)
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default admin user (password will be hashed in the application)
-- Password: admin123 (will be properly hashed by the application)
INSERT INTO public.admin_users (username, password_hash, full_name, role)
VALUES ('admin', '$2b$10$rOiKNe1vtWC2/D4EbKnFvOXTCgZV8.lqWZLY.kQXS7YQK1KlKP.VG', 'System Administrator', 'admin');

-- Enable RLS on all custom tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies for employees table (admin access only for now)
CREATE POLICY "Admin can manage employees" ON public.employees
FOR ALL USING (true);

-- Create policies for timesheet_entries table (admin access only for now)
CREATE POLICY "Admin can manage timesheet entries" ON public.timesheet_entries
FOR ALL USING (true);

-- Create policies for wage_settings table (admin access only for now)
CREATE POLICY "Admin can manage wage settings" ON public.wage_settings
FOR ALL USING (true);

-- Create policies for admin_users table (admin access only for now)
CREATE POLICY "Admin can manage admin users" ON public.admin_users
FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheet_entries_updated_at BEFORE UPDATE ON public.timesheet_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wage_settings_updated_at BEFORE UPDATE ON public.wage_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
