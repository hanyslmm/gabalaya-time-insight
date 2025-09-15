-- Fix remaining security warnings from linter

-- 1. Fix Function Search Path Mutable warning
-- Update all existing functions to have explicit search_path for security

-- Fix get_current_user_info function 
CREATE OR REPLACE FUNCTION public.get_current_user_info()
 RETURNS TABLE(user_id uuid, username text, role text, organization_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  -- This is a placeholder - will be set by the application
  SELECT 
    '00000000-0000-0000-0000-000000000000'::UUID as user_id,
    'anonymous'::TEXT as username,
    'anonymous'::TEXT as role,
    NULL::UUID as organization_id
  WHERE false; -- Never returns anything by default
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- Fix validate_admin_password function
CREATE OR REPLACE FUNCTION public.validate_admin_password(input_username text, input_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  stored_hash text;
BEGIN
  -- Get the password hash for the specified user
  SELECT password_hash INTO stored_hash
  FROM public.admin_users
  WHERE username = input_username;
  
  -- Return false if user not found
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Simple comparison (should be replaced with proper bcrypt in production)
  RETURN stored_hash = input_password;
END;
$function$;

-- Fix get_current_user_role_safe function
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT role FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$function$;

-- Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_username text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT role FROM public.admin_users WHERE username = user_username;
$function$;

-- Fix is_current_user_owner function
CREATE OR REPLACE FUNCTION public.is_current_user_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text) 
    AND (role = 'owner' OR is_global_owner = true)
  );
$function$;

-- Fix get_current_user_organization function
CREATE OR REPLACE FUNCTION public.get_current_user_organization()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT organization_id FROM public.admin_users WHERE username = (auth.jwt() ->> 'username'::text);
$function$;

-- Fix award_points function
CREATE OR REPLACE FUNCTION public.award_points(p_user_id uuid, p_points integer, p_reason text, p_action_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  -- Insert points history record
  INSERT INTO public.points_history (user_id, points, reason, action_type)
  VALUES (p_user_id, p_points, p_reason, p_action_type);
  
  -- Update or insert user rewards
  INSERT INTO public.user_rewards (user_id, total_points, level)
  VALUES (p_user_id, p_points, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_points = user_rewards.total_points + p_points,
    updated_at = now();
    
  -- Calculate new level (every 100 points = 1 level)
  SELECT total_points INTO new_total 
  FROM public.user_rewards 
  WHERE user_id = p_user_id;
  
  new_level := GREATEST(1, (new_total / 100) + 1);
  
  -- Update level
  UPDATE public.user_rewards 
  SET level = new_level 
  WHERE user_id = p_user_id;
END;
$function$;

-- Fix can_award_daily_points function
CREATE OR REPLACE FUNCTION public.can_award_daily_points(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Check if user already got visit points today
  RETURN NOT EXISTS (
    SELECT 1 FROM public.points_history 
    WHERE user_id = p_user_id 
    AND action_type = 'visit'
    AND DATE(created_at) = CURRENT_DATE
  );
END;
$function$;

-- Fix get_dashboard_stats function  
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(from_date text, to_date text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  v_employee_count int;
  v_total_hours numeric;
  v_total_payroll numeric;
  v_total_shifts int;
BEGIN
  -- Get count of employees who worked in the specified period
  SELECT COUNT(DISTINCT employee_id) INTO v_employee_count 
  FROM public.timesheet_entries
  WHERE clock_in_date >= from_date::date AND clock_in_date <= to_date::date;

  -- Aggregate timesheet data within the specified date range
  SELECT
    COALESCE(SUM(total_hours), 0),
    COALESCE(SUM(COALESCE(total_card_amount_split, total_card_amount_flat)), 0),
    COUNT(id)
  INTO
    v_total_hours,
    v_total_payroll,
    v_total_shifts
  FROM
    public.timesheet_entries
  WHERE
    clock_in_date >= from_date::date AND clock_in_date <= to_date::date;

  -- Return all stats as a single JSON object
  RETURN json_build_object(
    'employeeCount', v_employee_count,
    'totalHours', v_total_hours,
    'totalPayroll', v_total_payroll,
    'totalShifts', v_total_shifts
  );
END;
$function$;

-- Fix get_monthly_summary function
CREATE OR REPLACE FUNCTION public.get_monthly_summary(target_year integer, target_month integer)
 RETURNS TABLE(total_income numeric, total_expense numeric, net_profit numeric, transaction_count integer)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as net_profit,
    COUNT(*)::INTEGER as transaction_count
  FROM public.transactions t
  WHERE EXTRACT(YEAR FROM t.date) = target_year
    AND EXTRACT(MONTH FROM t.date) = target_month;
END;
$function$;

-- Fix clock_in function
CREATE OR REPLACE FUNCTION public.clock_in(p_staff_id text, p_clock_in_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  new_entry timesheet_entries;
BEGIN
  -- Find the employee using their staff_id.
  SELECT id, full_name INTO v_employee_id, v_employee_name
  FROM public.employees
  WHERE staff_id = p_staff_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No matching employee record found for your user account. Please contact your administrator.';
  END IF;

  -- Check for an existing active clock-in.
  IF EXISTS (
    SELECT 1 FROM public.timesheet_entries
    WHERE employee_id = v_employee_id AND clock_out_time IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already clocked in. Please clock out before clocking in again.';
  END IF;

  -- Insert the new clock-in record.
  INSERT INTO public.timesheet_entries (
    employee_id, employee_name, clock_in_date, clock_in_time, clock_in_location
  ) VALUES (
    v_employee_id, v_employee_name, CURRENT_DATE, CURRENT_TIME, p_clock_in_location
  )
  RETURNING * INTO new_entry;

  RETURN new_entry;
END;
$function$;

-- Fix clock_out function
CREATE OR REPLACE FUNCTION public.clock_out(p_entry_id uuid, p_clock_out_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  updated_entry timesheet_entries;
  v_clock_in_datetime timestamp;
  v_total_hours numeric;
BEGIN
  SELECT (clock_in_date + clock_in_time) INTO v_clock_in_datetime
  FROM public.timesheet_entries WHERE id = p_entry_id;

  IF v_clock_in_datetime IS NULL THEN
    RAISE EXCEPTION 'Timesheet entry not found.';
  END IF;

  v_total_hours := EXTRACT(EPOCH FROM (NOW() - v_clock_in_datetime)) / 3600.0;

  UPDATE public.timesheet_entries
  SET
    clock_out_date = CURRENT_DATE,
    clock_out_time = CURRENT_TIME,
    clock_out_location = p_clock_out_location,
    total_hours = v_total_hours
  WHERE id = p_entry_id
  RETURNING * INTO updated_entry;

  RETURN updated_entry;
END;
$function$;

-- Note: The "Extension in Public" warning typically refers to PostgreSQL extensions
-- This is usually managed by the platform and may require manual intervention
-- The other warnings (Auth OTP expiry, Postgres version) require platform-level changes

COMMENT ON SCHEMA public IS 'SECURITY: All functions now have explicit search_path set for security';