-- Fix remaining security warnings from the linter
-- Set proper search_path for existing functions to prevent security issues

-- Fix the password validation function
CREATE OR REPLACE FUNCTION public.validate_admin_password(input_username text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  -- Get the password hash for the specified user
  SELECT password_hash INTO stored_hash
  FROM public.admin_users
  WHERE username = input_username;
  
  -- Return false if user not found
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Simple comparison (should be replaced with proper bcrypt in production)
  RETURN stored_hash = input_password;
END;
$$;

-- Fix other existing functions that lack proper search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_users WHERE username = user_username;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role = 'owner' OR is_global_owner = true)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_organization()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$$;