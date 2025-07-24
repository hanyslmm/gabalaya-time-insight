-- Fix security warnings for database functions by setting search_path
-- This makes the functions more secure by preventing search path manipulation attacks

-- Update get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_username text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.admin_users WHERE username = user_username;
$function$;

-- Update get_monthly_summary function
CREATE OR REPLACE FUNCTION public.get_monthly_summary(target_year integer, target_month integer)
 RETURNS TABLE(total_income numeric, total_expense numeric, net_profit numeric, transaction_count integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
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

-- Update clock_in function
CREATE OR REPLACE FUNCTION public.clock_in(p_staff_id text, p_clock_in_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Update get_dashboard_stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(from_date text, to_date text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
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

-- Update clock_out function
CREATE OR REPLACE FUNCTION public.clock_out(p_entry_id uuid, p_clock_out_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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