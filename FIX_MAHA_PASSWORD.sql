-- Check if Maha Khalil exists in admin_users and fix her password
-- First, let's see what we have
SELECT username, full_name, role, password_hash, organization_id 
FROM admin_users 
WHERE username = 'EMP122037';

-- Update Maha Khalil's password to a proper bcrypt hash for 'admin123'
UPDATE admin_users
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE username = 'EMP122037';

-- Verify the update
SELECT username, full_name, role, 
       CASE 
         WHEN password_hash LIKE '$2b$%' THEN 'Bcrypt hash'
         ELSE 'Plain text'
       END as password_type
FROM admin_users 
WHERE username = 'EMP122037';
