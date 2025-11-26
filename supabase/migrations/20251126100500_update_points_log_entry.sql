CREATE OR REPLACE FUNCTION public.update_points_log_entry(
  p_log_id UUID,
  p_new_points INTEGER,
  p_new_reason TEXT,
  p_new_occurrence_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_employee_id UUID;
  v_old_points INTEGER;
  v_delta INTEGER;
  v_budget INTEGER;
BEGIN
  SELECT organization_id, employee_id, points INTO v_organization_id, v_employee_id, v_old_points
  FROM public.employee_points_log
  WHERE id = p_log_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Log not found');
  END IF;

  v_delta := p_new_points - v_old_points;

  IF v_delta > 0 THEN
    SELECT points_budget INTO v_budget FROM public.organizations WHERE id = v_organization_id;
    IF v_budget < v_delta THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient budget. Available: %s points, Required: %s points', v_budget, v_delta),
        'available_budget', v_budget
      );
    END IF;
    UPDATE public.organizations SET points_budget = points_budget - v_delta WHERE id = v_organization_id;
  ELSIF v_delta < 0 THEN
    UPDATE public.organizations SET points_budget = points_budget + ABS(v_delta) WHERE id = v_organization_id;
  END IF;

  UPDATE public.employee_points_log
  SET points = p_new_points,
      reason = COALESCE(p_new_reason, reason),
      occurrence_date = COALESCE(p_new_occurrence_date, occurrence_date),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_log_id;

  SELECT points_budget INTO v_budget FROM public.organizations WHERE id = v_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'updated_log_id', p_log_id,
    'remaining_budget', v_budget
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
