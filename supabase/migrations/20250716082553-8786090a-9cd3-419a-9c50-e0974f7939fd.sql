-- Create new administrator user with username 'Administrator' and password 'Voda@123'
INSERT INTO public.admin_users (username, password_hash, full_name, role) 
VALUES ('Administrator', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;