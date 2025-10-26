-- Create a function to promote an employee to admin role
-- This function runs with SECURITY DEFINER to bypass RLS policies

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
  -- Check if caller has permission (must be owner or admin)
  IF (auth.jwt() ->> 'role') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to promote employee to admin';
  END IF;

  -- Get the employee ID from the employees table
  SELECT id INTO v_employee_id
  FROM employees
  WHERE staff_id = p_staff_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee with staff_id % not found', p_staff_id;
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
    -- Create new admin user with default password
    INSERT INTO admin_users (username, password_hash, full_name, role, organization_id)
    VALUES (
      p_staff_id,
      '$2b$10$defaulthash', -- Default password hash, should be changed by user
      p_full_name,
      p_role,
      p_organization_id
    );
    
    v_result := json_build_object(
      'success', true,
      'message', 'Employee promoted to admin successfully',
      'action', 'create',
      'note', 'Default password set, user should change it on first login'
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION promote_employee_to_admin(TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION promote_employee_to_admin IS 'Promotes an employee to admin role by creating/updating admin_users entry. Requires owner or admin role.';

