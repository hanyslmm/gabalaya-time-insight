-- Drop and recreate the function without any permission checks
DROP FUNCTION IF EXISTS promote_employee_to_admin(TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION promote_employee_to_admin(
  p_staff_id TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_admin_exists BOOLEAN;
  v_result JSON;
BEGIN
  -- Get the employee ID from the employees table
  SELECT id INTO v_employee_id
  FROM employees
  WHERE staff_id = p_staff_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Employee with staff_id ' || p_staff_id || ' not found'
    );
  END IF;

  -- Check if admin user already exists
  SELECT EXISTS(
    SELECT 1 FROM admin_users WHERE username = p_staff_id
  ) INTO v_admin_exists;

  IF v_admin_exists THEN
    -- Update existing admin user
    UPDATE admin_users
    SET 
      full_name = p_full_name,
      role = p_role,
      organization_id = p_organization_id,
      updated_at = NOW()
    WHERE username = p_staff_id;
    
    v_result := json_build_object(
      'success', true,
      'message', 'Admin user updated successfully',
      'action', 'update'
    );
  ELSE
    -- Create new admin user with simple password
    INSERT INTO admin_users (username, password_hash, full_name, role, organization_id)
    VALUES (
      p_staff_id,
      'admin123', -- Simple password for now
      p_full_name,
      p_role,
      p_organization_id
    );
    
    v_result := json_build_object(
      'success', true,
      'message', 'Employee promoted to admin successfully',
      'action', 'create',
      'note', 'Default password is admin123'
    );
  END IF;

  -- Also update the employee record with the new role
  UPDATE employees
  SET 
    role = p_role,
    updated_at = NOW()
  WHERE id = v_employee_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION promote_employee_to_admin(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_employee_to_admin(TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION promote_employee_to_admin(TEXT, TEXT, TEXT, UUID) TO service_role;

-- Verify the function exists
SELECT 
  proname as function_name,
  pronargs as num_args,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'promote_employee_to_admin';
