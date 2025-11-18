-- Migration: Create Work Regulations Table
-- Date: 2025-01-15
-- Description: Creates table for organization work regulations with rich text content
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- TABLE: work_regulations
-- Purpose: Stores work regulations for each organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL, -- Rich text content (can be HTML or markdown)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT work_regulations_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT work_regulations_created_by_fk FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL,
  CONSTRAINT work_regulations_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL,
  CONSTRAINT work_regulations_org_unique UNIQUE (organization_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_work_regulations_organization ON public.work_regulations(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_regulations_active ON public.work_regulations(organization_id, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
ALTER TABLE public.work_regulations ENABLE ROW LEVEL SECURITY;

-- Everyone can view active regulations
DROP POLICY IF EXISTS "Anyone can view active work regulations" ON public.work_regulations;
CREATE POLICY "Anyone can view active work regulations"
ON public.work_regulations
FOR SELECT
USING (is_active = true);

-- Admins can insert/update/delete regulations (permissive RLS - security at app level)
DROP POLICY IF EXISTS "Admins can insert work regulations" ON public.work_regulations;
CREATE POLICY "Admins can insert work regulations"
ON public.work_regulations
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update work regulations" ON public.work_regulations;
CREATE POLICY "Admins can update work regulations"
ON public.work_regulations
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete work regulations" ON public.work_regulations;
CREATE POLICY "Admins can delete work regulations"
ON public.work_regulations
FOR DELETE
USING (true);

COMMIT;

