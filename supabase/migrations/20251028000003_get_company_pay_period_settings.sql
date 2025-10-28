-- SECURITY DEFINER read function to fetch pay period settings by organization

CREATE OR REPLACE FUNCTION get_company_pay_period_settings(
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_end_day INTEGER;
BEGIN
  SELECT pay_period_mode, pay_period_end_day
  INTO v_mode, v_end_day
  FROM company_settings
  WHERE organization_id = p_organization_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_mode IS NULL THEN
    -- Fallback defaults
    v_mode := 'fixed_day';
    v_end_day := 28;
  END IF;

  RETURN json_build_object(
    'pay_period_mode', v_mode,
    'pay_period_end_day', v_end_day
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('pay_period_mode', 'fixed_day', 'pay_period_end_day', 28);
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_pay_period_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_pay_period_settings(UUID) TO anon;

COMMENT ON FUNCTION get_company_pay_period_settings IS 'Returns pay period settings for organization, bypassing RLS.';


