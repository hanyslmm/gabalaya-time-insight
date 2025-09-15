-- EMERGENCY FIX: Infinite recursion in admin_users RLS policies
-- The issue is policies are querying admin_users table within admin_users policies

-- First, create security definer functions to safely check user roles without triggering RLS
CREATE OR REPLACE FUNCTION public.get_current_admin_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT role FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$function$;

CREATE OR REPLACE FUNCTION public.is_current_user_global_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT COALESCE(is_global_owner, false) FROM public.admin_users 
  WHERE username = (auth.jwt() ->> 'username'::text);
$function$;

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Admins can update their own profile" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view their own profile" ON public.admin_users;
DROP POLICY IF EXISTS "Global owners can create admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Global owners can delete other admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Global owners can view all admin users" ON public.admin_users;

-- Create new policies using the security definer functions (no infinite recursion)
CREATE POLICY "Users can view their own admin profile"
ON public.admin_users
FOR SELECT
USING (username = (auth.jwt() ->> 'username'::text));

CREATE POLICY "Users can update their own admin profile"
ON public.admin_users
FOR UPDATE
USING (username = (auth.jwt() ->> 'username'::text))
WITH CHECK (username = (auth.jwt() ->> 'username'::text));

CREATE POLICY "Global owners can view all admin users"
ON public.admin_users
FOR SELECT
USING (public.is_current_user_global_owner() = true);

CREATE POLICY "Global owners can create admin users"
ON public.admin_users
FOR INSERT
WITH CHECK (public.is_current_user_global_owner() = true);

CREATE POLICY "Global owners can update admin users"
ON public.admin_users
FOR UPDATE
USING (public.is_current_user_global_owner() = true)
WITH CHECK (public.is_current_user_global_owner() = true);

CREATE POLICY "Global owners can delete admin users (except themselves)"
ON public.admin_users
FOR DELETE
USING (
  public.is_current_user_global_owner() = true 
  AND username != (auth.jwt() ->> 'username'::text)
);

-- Verify RLS is still enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'admin_users' AND schemaname = 'public';