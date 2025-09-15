-- Emergency admin password reset to requested value (plaintext for immediate access)
UPDATE public.admin_users
SET password_hash = 'mVoda@_135792',
    updated_at = now()
WHERE username = 'admin';

-- Confirm the row was updated
SELECT username, role, updated_at FROM public.admin_users WHERE username = 'admin';