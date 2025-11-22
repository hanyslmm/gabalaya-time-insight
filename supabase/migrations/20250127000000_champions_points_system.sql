-- Champions Points System Migration
-- This migration adds a gamified points system with monetary value, budgets, and transaction tracking
-- Feature flag: is_points_system_active (default: false) - Safe rollout, non-destructive

-- ============================================================================
-- STEP 1: Add Points System Configuration to Organizations Table
-- ============================================================================

-- Add points system configuration columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS is_points_system_active BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS points_budget INTEGER NOT NULL DEFAULT 0 CHECK (points_budget >= 0),
ADD COLUMN IF NOT EXISTS point_value DECIMAL(10,2) NOT NULL DEFAULT 5.00 CHECK (point_value > 0);

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.is_points_system_active IS 'Feature flag to enable/disable points system per organization';
COMMENT ON COLUMN public.organizations.points_budget IS 'Monthly points budget (in points, not EGP). Managers spend from this when awarding positive points.';
COMMENT ON COLUMN public.organizations.point_value IS 'Monetary value of 1 point in EGP (default: 5 EGP)';

-- ============================================================================
-- STEP 2: Create Points Catalog Table (Dynamic Menu of Rewards/Penalties)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.points_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL, -- Can be negative for penalties
  category TEXT NOT NULL CHECK (category IN ('reward', 'penalty')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.admin_users(id),
  UNIQUE(organization_id, label)
);

-- Enable RLS on points_catalog
ALTER TABLE public.points_catalog ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policy (security enforced at application level)
CREATE POLICY "Manage points catalog" ON public.points_catalog
FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_catalog_organization_id 
ON public.points_catalog(organization_id);

CREATE INDEX IF NOT EXISTS idx_points_catalog_category 
ON public.points_catalog(category);

CREATE INDEX IF NOT EXISTS idx_points_catalog_is_active 
ON public.points_catalog(is_active);

-- Add trigger to update updated_at
CREATE TRIGGER update_points_catalog_updated_at 
BEFORE UPDATE ON public.points_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 3: Create Employee Points Log Table (Transaction History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_points_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- Can be negative for penalties
  reason TEXT NOT NULL, -- Label from catalog or custom reason
  occurrence_date DATE NOT NULL, -- Date when the event occurred (not when logged)
  created_by UUID REFERENCES public.admin_users(id), -- Manager/admin who awarded the points
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  catalog_item_id UUID REFERENCES public.points_catalog(id), -- Optional reference to catalog item
  notes TEXT -- Additional notes
);

-- Enable RLS on employee_points_log
ALTER TABLE public.employee_points_log ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policy (security enforced at application level)
CREATE POLICY "Manage employee points log" ON public.employee_points_log
FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_points_log_employee_id 
ON public.employee_points_log(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_points_log_organization_id 
ON public.employee_points_log(organization_id);

CREATE INDEX IF NOT EXISTS idx_employee_points_log_occurrence_date 
ON public.employee_points_log(occurrence_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_points_log_created_at 
ON public.employee_points_log(created_at DESC);

-- ============================================================================
-- STEP 4: Create Award Points Transaction Function (Budget Validation)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_points_transaction(
  p_employee_id UUID,
  p_points INTEGER,
  p_reason TEXT,
  p_occurrence_date DATE DEFAULT CURRENT_DATE,
  p_catalog_item_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_is_active BOOLEAN;
  v_points_budget INTEGER;
  v_created_by UUID;
  v_username TEXT;
  v_log_id UUID;
  v_result JSONB;
BEGIN
  -- Get employee's organization
  SELECT organization_id INTO v_organization_id
  FROM public.employees
  WHERE id = p_employee_id;
  
  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Employee not found'
    );
  END IF;
  
  -- Check if points system is active for this organization
  SELECT is_points_system_active, points_budget INTO v_is_active, v_points_budget
  FROM public.organizations
  WHERE id = v_organization_id;
  
  IF NOT v_is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Points system is not active for this organization'
    );
  END IF;
  
  -- Get current user (manager/admin who is awarding points)
  v_username := COALESCE(
    auth.jwt() ->> 'username',
    current_setting('request.jwt.claims', true)::json ->> 'username'
  );
  
  IF v_username IS NOT NULL THEN
    SELECT id INTO v_created_by
    FROM public.admin_users
    WHERE username = v_username
    LIMIT 1;
  END IF;
  
  -- Critical Rule: If awarding positive points, check budget
  -- Note: Deducting points (penalties) does NOT refund the budget
  IF p_points > 0 THEN
    IF v_points_budget < p_points THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient budget. Available: %s points, Required: %s points', v_points_budget, p_points),
        'available_budget', v_points_budget
      );
    END IF;
    
    -- Deduct from budget
    UPDATE public.organizations
    SET points_budget = points_budget - p_points
    WHERE id = v_organization_id;
  END IF;
  
  -- Insert points log entry
  INSERT INTO public.employee_points_log (
    employee_id,
    organization_id,
    points,
    reason,
    occurrence_date,
    created_by,
    catalog_item_id,
    notes
  )
  VALUES (
    p_employee_id,
    v_organization_id,
    p_points,
    p_reason,
    p_occurrence_date,
    v_created_by,
    p_catalog_item_id,
    p_notes
  )
  RETURNING id INTO v_log_id;
  
  -- Get updated budget
  SELECT points_budget INTO v_points_budget
  FROM public.organizations
  WHERE id = v_organization_id;
  
  -- Return success with updated budget
  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'points_awarded', p_points,
    'remaining_budget', v_points_budget
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 5: Helper Functions for Points Calculations
-- ============================================================================

-- Get employee's total points
CREATE OR REPLACE FUNCTION public.get_employee_total_points(p_employee_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_points INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.employee_points_log
  WHERE employee_id = p_employee_id;
  
  RETURN v_total_points;
END;
$$;

-- Get employee's points potential bonus in EGP
CREATE OR REPLACE FUNCTION public.get_employee_points_bonus_egp(p_employee_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_points INTEGER;
  v_point_value DECIMAL;
  v_organization_id UUID;
BEGIN
  -- Get employee's organization
  SELECT organization_id INTO v_organization_id
  FROM public.employees
  WHERE id = p_employee_id;
  
  IF v_organization_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get total points
  v_total_points := public.get_employee_total_points(p_employee_id);
  
  -- Get point value for organization
  SELECT point_value INTO v_point_value
  FROM public.organizations
  WHERE id = v_organization_id;
  
  RETURN COALESCE(v_total_points * v_point_value, 0);
END;
$$;

-- Get employee's level based on points (for gamification)
CREATE OR REPLACE FUNCTION public.get_employee_level(p_employee_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_points INTEGER;
BEGIN
  v_total_points := public.get_employee_total_points(p_employee_id);
  
  -- Level tiers (can be customized)
  IF v_total_points >= 100 THEN
    RETURN 'Legend';
  ELSIF v_total_points >= 50 THEN
    RETURN 'Champion';
  ELSIF v_total_points >= 25 THEN
    RETURN 'Rising Star';
  ELSIF v_total_points >= 10 THEN
    RETURN 'Achiever';
  ELSIF v_total_points >= 0 THEN
    RETURN 'Starter';
  ELSE
    RETURN 'Improving';
  END IF;
END;
$$;

-- Get organization's remaining budget
CREATE OR REPLACE FUNCTION public.get_organization_points_budget(p_organization_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_budget INTEGER;
BEGIN
  SELECT points_budget INTO v_budget
  FROM public.organizations
  WHERE id = p_organization_id;
  
  RETURN COALESCE(v_budget, 0);
END;
$$;

-- ============================================================================
-- STEP 6: Seed Data Function (Unified Catalog)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_points_catalog(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only seed if catalog is empty for this organization
  IF EXISTS (SELECT 1 FROM public.points_catalog WHERE organization_id = p_organization_id) THEN
    RETURN;
  END IF;
  
  -- Rewards
  INSERT INTO public.points_catalog (organization_id, label, points, category, description) VALUES
    (p_organization_id, 'Emergency Shift', 5, 'reward', 'Covered an emergency shift'),
    (p_organization_id, 'Parent Review', 5, 'reward', 'Received positive parent review'),
    (p_organization_id, 'New Idea', 4, 'reward', 'Suggested a new improvement idea'),
    (p_organization_id, 'Closing Bonus', 3, 'reward', 'Excellent closing performance'),
    (p_organization_id, 'Perfect Month', 15, 'reward', 'Perfect attendance for the month');
  
  -- Penalties
  INSERT INTO public.points_catalog (organization_id, label, points, category, description) VALUES
    (p_organization_id, 'Late > 15m', -4, 'penalty', 'Arrived more than 15 minutes late'),
    (p_organization_id, 'Late < 15m', -2, 'penalty', 'Arrived less than 15 minutes late'),
    (p_organization_id, 'Mobile Violation', -10, 'penalty', 'Used mobile phone during work hours'),
    (p_organization_id, 'No-Show', -20, 'penalty', 'Did not show up for scheduled shift'),
    (p_organization_id, 'Uniform', -3, 'penalty', 'Uniform policy violation');
  
END;
$$;

-- ============================================================================
-- STEP 7: Top-up Budget Function (for Owners)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.top_up_points_budget(
  p_organization_id UUID,
  p_additional_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_budget INTEGER;
BEGIN
  IF p_additional_points <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Additional points must be positive'
    );
  END IF;
  
  UPDATE public.organizations
  SET points_budget = points_budget + p_additional_points
  WHERE id = p_organization_id
  RETURNING points_budget INTO v_new_budget;
  
  IF v_new_budget IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization not found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_budget', v_new_budget
  );
END;
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Note: This migration is non-destructive:
-- - All new columns have defaults
-- - Feature flag defaults to false (disabled)
-- - Existing functionality remains unchanged
-- - Can be safely rolled back by dropping new tables/functions and removing columns

