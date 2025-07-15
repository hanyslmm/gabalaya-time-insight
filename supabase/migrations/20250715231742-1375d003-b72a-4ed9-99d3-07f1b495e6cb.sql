-- Update default admin password to Voda@123
UPDATE admin_users 
SET password_hash = '$2b$10$3KqGbqJj6vU9Lg6SkYsVPO4xEGLX8XKk5QZ7yv8RGmXY7hg9XA8BG' 
WHERE username = 'admin' AND id = 'b7d8f045-1234-5678-9abc-def123456789';