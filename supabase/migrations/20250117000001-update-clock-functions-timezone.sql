-- Update clock_in function to use company timezone
CREATE OR REPLACE FUNCTION public.clock_in(p_staff_id text, p_clock_in_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_company_timezone text;
  v_company_now timestamp;
  v_company_date date;
  v_company_time time;
  new_entry timesheet_entries;
BEGIN
  -- Get company timezone
  v_company_timezone := get_company_timezone();
  
  -- Get current time in company timezone
  v_company_now := utc_to_company_time(NOW());
  v_company_date := v_company_now::date;
  v_company_time := v_company_now::time;
  
  -- Find the employee using their staff_id.
  SELECT id, full_name INTO v_employee_id, v_employee_name
  FROM public.employees
  WHERE staff_id = p_staff_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No matching employee record found for your user account. Please contact your administrator.';
  END IF;

  -- Check for an existing active clock-in for today in company timezone
  IF EXISTS (
    SELECT 1 FROM public.timesheet_entries
    WHERE employee_id = v_employee_id 
    AND clock_out_time IS NULL
    AND clock_in_date = v_company_date
  ) THEN
    RAISE EXCEPTION 'You are already clocked in. Please clock out before clocking in again.';
  END IF;

  -- Insert the new clock-in record using company timezone
  INSERT INTO public.timesheet_entries (
    employee_id, employee_name, clock_in_date, clock_in_time, clock_in_location
  ) VALUES (
    v_employee_id, v_employee_name, v_company_date, v_company_time, p_clock_in_location
  )
  RETURNING * INTO new_entry;

  RETURN new_entry;
END;
$function$;

-- Update clock_out function to use company timezone
CREATE OR REPLACE FUNCTION public.clock_out(p_entry_id uuid, p_clock_out_location text)
 RETURNS timesheet_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_entry timesheet_entries;
  v_clock_in_datetime timestamp;
  v_clock_out_datetime timestamp;
  v_company_timezone text;
  v_company_now timestamp;
  v_company_date date;
  v_company_time time;
  v_total_hours numeric;
BEGIN
  -- Get company timezone
  v_company_timezone := get_company_timezone();
  
  -- Get current time in company timezone
  v_company_now := utc_to_company_time(NOW());
  v_company_date := v_company_now::date;
  v_company_time := v_company_now::time;
  
  -- Get the clock-in datetime for the entry
  SELECT (clock_in_date + clock_in_time) INTO v_clock_in_datetime
  FROM public.timesheet_entries WHERE id = p_entry_id;

  IF v_clock_in_datetime IS NULL THEN
    RAISE EXCEPTION 'Timesheet entry not found.';
  END IF;

  -- Calculate clock-out datetime in company timezone
  v_clock_out_datetime := (v_company_date + v_company_time);
  
  -- Calculate total hours worked
  v_total_hours := EXTRACT(EPOCH FROM (v_clock_out_datetime - v_clock_in_datetime)) / 3600.0;
  
  -- Ensure we don't have negative hours (shouldn't happen but safety check)
  IF v_total_hours < 0 THEN
    v_total_hours := 0;
  END IF;

  -- Update the timesheet entry with clock-out information
  UPDATE public.timesheet_entries
  SET
    clock_out_date = v_company_date,
    clock_out_time = v_company_time,
    clock_out_location = p_clock_out_location,
    total_hours = v_total_hours
  WHERE id = p_entry_id
  RETURNING * INTO updated_entry;

  RETURN updated_entry;
END;
$function$;