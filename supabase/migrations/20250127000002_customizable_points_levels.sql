-- ============================================================================
-- Customizable Points Levels System
-- Allows owners to configure point thresholds and rename levels per organization
-- ============================================================================

-- Create points_levels table
CREATE TABLE IF NOT EXISTS public.points_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  level_name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER, -- NULL means no upper limit (highest level)
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT points_levels_organization_level_name_unique UNIQUE (organization_id, level_name),
  CONSTRAINT points_levels_min_points_check CHECK (min_points >= 0),
  CONSTRAINT points_levels_max_points_check CHECK (max_points IS NULL OR max_points > min_points)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_points_levels_organization_id ON public.points_levels(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_levels_display_order ON public.points_levels(organization_id, display_order);

-- Enable RLS
ALTER TABLE public.points_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for points_levels
CREATE POLICY "Users can view points levels for their organization"
  ON public.points_levels
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE id = (SELECT COALESCE(
        (SELECT current_organization_id FROM public.admin_users WHERE id = auth.uid()),
        (SELECT organization_id FROM public.admin_users WHERE id = auth.uid()),
        (SELECT organization_id FROM public.employees WHERE id = auth.uid())
      ))
    )
  );

CREATE POLICY "Owners and admins can manage points levels for their organization"
  ON public.points_levels
  FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM public.organizations
      WHERE id = (SELECT COALESCE(
        (SELECT current_organization_id FROM public.admin_users WHERE id = auth.uid()),
        (SELECT organization_id FROM public.admin_users WHERE id = auth.uid())
      ))
      AND EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = auth.uid()
        AND (role = 'owner' OR role = 'admin')
      )
    )
  );

-- Function to seed default levels for an organization
CREATE OR REPLACE FUNCTION public.seed_default_points_levels(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only seed if no levels exist for this organization
  IF NOT EXISTS (SELECT 1 FROM public.points_levels WHERE organization_id = p_organization_id) THEN
    INSERT INTO public.points_levels (organization_id, level_name, min_points, max_points, display_order, is_active)
    VALUES
      (p_organization_id, 'Starter', 0, 24, 1, true),
      (p_organization_id, 'Rising Star', 25, 49, 2, true),
      (p_organization_id, 'Champion', 50, 99, 3, true),
      (p_organization_id, 'Legend', 100, NULL, 4, true);
  END IF;
END;
$$;

-- Update get_employee_level function to use custom levels
CREATE OR REPLACE FUNCTION public.get_employee_level(p_employee_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_total_points INTEGER;
  v_level_name TEXT;
BEGIN
  -- Get employee's organization
  SELECT organization_id INTO v_organization_id
  FROM public.employees
  WHERE id = p_employee_id;
  
  IF v_organization_id IS NULL THEN
    RETURN 'Starter';
  END IF;
  
  -- Get employee's total points
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.employee_points_log
  WHERE employee_id = p_employee_id;
  
  -- Find the appropriate level based on custom levels
  SELECT level_name INTO v_level_name
  FROM public.points_levels
  WHERE organization_id = v_organization_id
    AND is_active = true
    AND min_points <= v_total_points
    AND (max_points IS NULL OR v_total_points <= max_points)
  ORDER BY display_order DESC
  LIMIT 1;
  
  -- Fallback to default if no custom level found
  IF v_level_name IS NULL THEN
    IF v_total_points >= 100 THEN
      RETURN 'Legend';
    ELSIF v_total_points >= 50 THEN
      RETURN 'Champion';
    ELSIF v_total_points >= 25 THEN
      RETURN 'Rising Star';
    ELSE
      RETURN 'Starter';
    END IF;
  END IF;
  
  RETURN v_level_name;
END;
$$;

-- Function to get level configuration for an organization
CREATE OR REPLACE FUNCTION public.get_organization_levels(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_levels JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'level_name', level_name,
      'min_points', min_points,
      'max_points', max_points,
      'display_order', display_order,
      'is_active', is_active
    )
    ORDER BY display_order
  ) INTO v_levels
  FROM public.points_levels
  WHERE organization_id = p_organization_id
    AND is_active = true;
  
  RETURN COALESCE(v_levels, '[]'::jsonb);
END;
$$;

-- Function to get next level threshold for progress calculation
CREATE OR REPLACE FUNCTION public.get_next_level_threshold(p_employee_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_total_points INTEGER;
  v_next_threshold INTEGER;
BEGIN
  -- Get employee's organization
  SELECT organization_id INTO v_organization_id
  FROM public.employees
  WHERE id = p_employee_id;
  
  IF v_organization_id IS NULL THEN
    RETURN 25; -- Default next threshold
  END IF;
  
  -- Get employee's total points
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.employee_points_log
  WHERE employee_id = p_employee_id;
  
  -- Find the next level's min_points
  SELECT min_points INTO v_next_threshold
  FROM public.points_levels
  WHERE organization_id = v_organization_id
    AND is_active = true
    AND min_points > v_total_points
  ORDER BY display_order ASC
  LIMIT 1;
  
  -- Fallback to default thresholds
  IF v_next_threshold IS NULL THEN
    IF v_total_points < 25 THEN
      RETURN 25;
    ELSIF v_total_points < 50 THEN
      RETURN 50;
    ELSIF v_total_points < 100 THEN
      RETURN 100;
    ELSE
      RETURN 150; -- Beyond legend, use 150 as next milestone
    END IF;
  END IF;
  
  RETURN v_next_threshold;
END;
$$;

-- Trigger to auto-seed levels when points system is activated
CREATE OR REPLACE FUNCTION public.auto_seed_levels_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If points system is being activated and was previously inactive
  IF NEW.is_points_system_active = true AND (OLD.is_points_system_active = false OR OLD IS NULL) THEN
    PERFORM public.seed_default_points_levels(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_seed_levels
  AFTER INSERT OR UPDATE OF is_points_system_active
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_seed_levels_on_activation();

-- ============================================================================
-- Migration Complete!
-- ============================================================================

