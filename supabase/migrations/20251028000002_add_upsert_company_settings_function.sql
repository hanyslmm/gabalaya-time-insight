-- Create SECURITY DEFINER function to upsert company pay period settings
-- Bypasses RLS safely from the client while keeping logic in the database

CREATE OR REPLACE FUNCTION upsert_company_pay_period_settings(
  p_organization_id UUID,
  p_pay_period_mode TEXT,
  p_pay_period_end_day INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_new_id INTEGER;
BEGIN
  -- Validate inputs
  IF p_pay_period_mode NOT IN ('fixed_day', 'month_dynamic') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid pay_period_mode');
  END IF;
  IF p_pay_period_end_day IS NULL OR p_pay_period_end_day < 1 OR p_pay_period_end_day > 31 THEN
    RETURN json_build_object('success', false, 'error', 'pay_period_end_day must be between 1 and 31');
  END IF;

  -- Check if row exists for organization
  SELECT EXISTS(
    SELECT 1 FROM company_settings WHERE organization_id = p_organization_id
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE company_settings
    SET pay_period_mode = p_pay_period_mode,
        pay_period_end_day = p_pay_period_end_day,
        updated_at = NOW()
    WHERE organization_id = p_organization_id;
  ELSE
    -- Generate a new integer id since legacy schema uses id INTEGER PRIMARY KEY DEFAULT 1
    SELECT COALESCE(MAX(id) + 1, 1) INTO v_new_id FROM company_settings;
    INSERT INTO company_settings (id, organization_id, pay_period_mode, pay_period_end_day, updated_at)
    VALUES (v_new_id, p_organization_id, p_pay_period_mode, p_pay_period_end_day, NOW());
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_company_pay_period_settings(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_company_pay_period_settings(UUID, TEXT, INTEGER) TO anon;

COMMENT ON FUNCTION upsert_company_pay_period_settings IS 'Upserts company pay period settings by organization. SECURITY DEFINER to bypass RLS.';


