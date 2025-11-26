CREATE OR REPLACE FUNCTION public.update_points_log_entry(
  p_log_id UUID,
  p_catalog_item_id UUID,
  p_new_occurrence_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_old_points INTEGER;
  v_new_points INTEGER;
  v_new_reason TEXT;
  v_catalog_org UUID;
  v_budget INTEGER;
BEGIN
  SELECT organization_id, points INTO v_organization_id, v_old_points
  FROM public.employee_points_log
  WHERE id = p_log_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log not found');
  END IF;

  SELECT points, label, organization_id INTO v_new_points, v_new_reason, v_catalog_org
  FROM public.points_catalog
  WHERE id = p_catalog_item_id;

  IF v_new_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catalog item not found');
  END IF;

  IF v_catalog_org IS DISTINCT FROM v_organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catalog item belongs to another organization');
  END IF;

  IF v_new_points > v_old_points THEN
    SELECT points_budget INTO v_budget FROM public.organizations WHERE id = v_organization_id;
    IF v_budget < (v_new_points - v_old_points) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient budget. Available: %s points, Required: %s points', v_budget, (v_new_points - v_old_points)),
        'available_budget', v_budget
      );
    END IF;
    UPDATE public.organizations SET points_budget = points_budget - (v_new_points - v_old_points)
    WHERE id = v_organization_id;
  ELSIF v_new_points < v_old_points THEN
    UPDATE public.organizations SET points_budget = points_budget + (v_old_points - v_new_points)
    WHERE id = v_organization_id;
  END IF;

  UPDATE public.employee_points_log
  SET points = v_new_points,
      reason = v_new_reason,
      catalog_item_id = p_catalog_item_id,
      occurrence_date = COALESCE(p_new_occurrence_date, occurrence_date),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_log_id;

  SELECT points_budget INTO v_budget FROM public.organizations WHERE id = v_organization_id;

  RETURN jsonb_build_object('success', true, 'updated_log_id', p_log_id, 'remaining_budget', v_budget);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_points_log_entry(
  p_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_points INTEGER;
  v_budget INTEGER;
BEGIN
  SELECT organization_id, points INTO v_organization_id, v_points
  FROM public.employee_points_log
  WHERE id = p_log_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log not found');
  END IF;

  IF v_points > 0 THEN
    UPDATE public.organizations SET points_budget = points_budget + v_points WHERE id = v_organization_id;
  END IF;

  DELETE FROM public.employee_points_log WHERE id = p_log_id;

  SELECT points_budget INTO v_budget FROM public.organizations WHERE id = v_organization_id;

  RETURN jsonb_build_object('success', true, 'deleted_log_id', p_log_id, 'remaining_budget', v_budget);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
