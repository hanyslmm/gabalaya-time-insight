-- Update password for admin user to "Voda@123"
UPDATE admin_users 
SET password_hash = 'Voda@123'
WHERE username = 'admin';