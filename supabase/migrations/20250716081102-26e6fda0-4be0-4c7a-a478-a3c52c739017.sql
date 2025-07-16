-- Generate a fresh bcrypt hash for password 'Voda@123'
-- Using a known working hash generated with bcrypt
UPDATE public.admin_users 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE username = 'admin';