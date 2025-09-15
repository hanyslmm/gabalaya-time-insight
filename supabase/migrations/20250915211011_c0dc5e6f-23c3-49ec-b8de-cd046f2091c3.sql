-- CRITICAL SECURITY FIX: Fix overly permissive RLS policies on users table
-- Current policies allow unrestricted public access to sensitive data including passwords

-- Drop existing dangerous policies
DROP POLICY IF EXISTS "Only admins can modify users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Create secure RLS policies that actually restrict access
-- Users can only view their own profile (not others)
CREATE POLICY "Users can view own profile only" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Users can only update their own profile (not others)  
CREATE POLICY "Users can update own profile only"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile only
CREATE POLICY "Users can insert own profile only"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Only authenticated users with admin role can delete users
-- Note: This assumes there's a way to check admin role - you may need to adjust
CREATE POLICY "Only system can delete users"
ON public.users
FOR DELETE
USING (false); -- Prevent all deletes for now until proper admin role check is implemented

-- Add logging to track any potential security issues
COMMENT ON TABLE public.users IS 'SECURITY: This table contains sensitive user data. Access is restricted by RLS policies. Consider migrating to admin_users table if this is legacy.';

-- Verify RLS is enabled (should already be enabled)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public';