-- Force change admin password (hashed provided by client)
-- SECURITY DEFINER to bypass RLS

CREATE OR REPLACE FUNCTION force_change_admin_password_hashed(
  p_username TEXT,
  p_password_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM admin_users WHERE username = p_username) INTO v_exists;

  IF NOT v_exists THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE admin_users
  SET password_hash = p_password_hash,
      updated_at = NOW()
  WHERE username = p_username;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION force_change_admin_password_hashed(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION force_change_admin_password_hashed(TEXT, TEXT) TO anon;

