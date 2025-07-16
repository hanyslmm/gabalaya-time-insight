-- Create a simple admin user with plain text password for now
INSERT INTO public.admin_users (username, password_hash, full_name, role)
VALUES ('admin', 'admin123', 'Simple Admin', 'admin')
ON CONFLICT (username) 
DO UPDATE SET 
  password_hash = 'admin123',
  full_name = 'Simple Admin',
  role = 'admin';