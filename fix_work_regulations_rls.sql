-- Fix RLS for work_regulations so admins/owners can manage,
-- and employees only see active regulations in their organization.

BEGIN;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.work_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.work_regulations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view active work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can insert work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can update work regulations" ON public.work_regulations;
DROP POLICY IF EXISTS "Admins can delete work regulations" ON public.work_regulations;

-- View policy: employees see only active regulations in their org, owners see all active
CREATE POLICY "Users can view active work regulations in their org"
ON public.work_regulations
FOR SELECT
USING ((is_owner()) OR (organization_id = current_user_organization_id() AND is_active = true));

-- Insert policy: admins (or owners) can create regulation for their org
CREATE POLICY "Admins can insert work regulations in their org"
ON public.work_regulations
FOR INSERT
WITH CHECK ((is_owner()) OR (is_admin() AND organization_id = current_user_organization_id()));

-- Update policy: admins (or owners) can update regulation for their org
CREATE POLICY "Admins can update work regulations in their org"
ON public.work_regulations
FOR UPDATE
USING ((is_owner()) OR (is_admin() AND organization_id = current_user_organization_id()))
WITH CHECK ((is_owner()) OR (is_admin() AND organization_id = current_user_organization_id()));

-- Delete policy: admins (or owners) can delete regulation for their org
CREATE POLICY "Admins can delete work regulations in their org"
ON public.work_regulations
FOR DELETE
USING ((is_owner()) OR (is_admin() AND organization_id = current_user_organization_id()));

COMMIT;

-- Verification: list policies on work_regulations
SELECT polname as policy_name, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'work_regulations';