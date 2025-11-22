-- Add timesheet_entry_id to employee_points_log to link points to specific shifts
-- This allows managers to award points for specific completed shifts

-- Add column to employee_points_log table
ALTER TABLE public.employee_points_log 
ADD COLUMN IF NOT EXISTS timesheet_entry_id UUID REFERENCES public.timesheet_entries(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employee_points_log_timesheet_entry_id 
ON public.employee_points_log(timesheet_entry_id);

-- Update award_points_transaction function to accept timesheet_entry_id
CREATE OR REPLACE FUNCTION public.award_points_transaction(
  p_employee_id UUID,
  p_points INTEGER,
  p_reason TEXT,
  p_occurrence_date DATE DEFAULT CURRENT_DATE,
  p_catalog_item_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_timesheet_entry_id UUID DEFAULT NULL
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
  
  -- Validate timesheet_entry_id if provided (must belong to the employee)
  IF p_timesheet_entry_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.timesheet_entries 
      WHERE id = p_timesheet_entry_id 
      AND employee_id = p_employee_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Timesheet entry does not belong to this employee'
      );
    END IF;
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
    notes,
    timesheet_entry_id
  )
  VALUES (
    p_employee_id,
    v_organization_id,
    p_points,
    p_reason,
    p_occurrence_date,
    v_created_by,
    p_catalog_item_id,
    p_notes,
    p_timesheet_entry_id
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
