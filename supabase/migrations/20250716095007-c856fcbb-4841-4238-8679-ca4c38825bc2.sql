-- Create a proper admin account with complex password
-- First, check if admin exists and update/create
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    -- Check if admin user exists
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE username = 'administrator') INTO admin_exists;
    
    IF admin_exists THEN
        -- Update existing admin
        UPDATE admin_users 
        SET password_hash = '$2b$10$K8yF3mNhP7Qx2vR9s1B5e.mLz6hN4pV8tC3dS9fG2hE5kR7xY1mA0', -- Complex password: Admin@2025!Secure
            full_name = 'System Administrator',
            role = 'admin',
            updated_at = now()
        WHERE username = 'administrator';
    ELSE
        -- Create new admin
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ('administrator', '$2b$10$K8yF3mNhP7Qx2vR9s1B5e.mLz6hN4pV8tC3dS9fG2hE5kR7xY1mA0', 'System Administrator', 'admin');
    END IF;
    
    -- Ensure Donia Amal has admin role in admin_users table
    UPDATE admin_users 
    SET role = 'admin', full_name = 'Donia Amal'
    WHERE username = 'EMP085382';
    
    -- If Donia doesn't exist in admin_users, create entry
    INSERT INTO admin_users (username, password_hash, full_name, role)
    SELECT 'EMP085382', '$2b$10$defaulthash', 'Donia Amal', 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE username = 'EMP085382');
    
END $$;