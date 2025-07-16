-- Update the default admin password to Voda@123 (bcrypt hash)
UPDATE public.admin_users 
SET password_hash = '$2b$10$GvwS7hNgXGnGX1VlLPzNde3jO/6XcCM7oQZjzNhOKKfqCNOOBNhM.'
WHERE username = 'admin';