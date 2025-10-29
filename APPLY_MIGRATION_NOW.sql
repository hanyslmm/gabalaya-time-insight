-- ============================================================================
-- STEP 1: Apply the timezone fix migration
-- ============================================================================
-- Copy and paste ALL of this into Supabase SQL Editor and run

-- Create timezone helper functions
CREATE OR REPLACE FUNCTION get_company_timezone()
RETURNS TEXT AS $$
DECLARE
    tz TEXT;
BEGIN
    SELECT timezone INTO tz FROM public.company_settings LIMIT 1;
    RETURN COALESCE(tz, 'Africa/Cairo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert UTC to company timezone
CREATE OR REPLACE FUNCTION utc_to_company_time(utc_time TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP AS $$
DECLARE
    company_tz TEXT;
BEGIN
    company_tz := get_company_timezone();
    RETURN utc_time AT TIME ZONE company_tz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIXED clock_in function - properly stores Cairo local time
CREATE OR REPLACE FUNCTION public.clock_in(p_staff_id text, p_clock_in_location text)
RETURNS timesheet_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_organization_id uuid;
  v_company_timezone text;
  v_company_now timestamp;
  v_company_date date;
  v_company_time time;
  new_entry timesheet_entries;
BEGIN
  -- Get company timezone
  v_company_timezone := get_company_timezone();
  
  -- Get current time in company timezone (Africa/Cairo)
  v_company_now := utc_to_company_time(NOW());
  v_company_date := v_company_now::date;
  v_company_time := v_company_now::time;
  
  -- Find the employee using their staff_id
  SELECT id, full_name, organization_id INTO v_employee_id, v_employee_name, v_organization_id
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

  -- Insert the new clock-in record using Cairo local time
  INSERT INTO public.timesheet_entries (
    employee_id, 
    employee_name, 
    clock_in_date, 
    clock_in_time, 
    clock_in_location,
    organization_id
  ) VALUES (
    v_employee_id, 
    v_employee_name, 
    v_company_date, 
    v_company_time, 
    p_clock_in_location,
    v_organization_id
  )
  RETURNING * INTO new_entry;

  RETURN new_entry;
END;
$function$;

-- FIXED clock_out function - properly stores Cairo local time and calculates split hours
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
  v_morning_hours numeric := 0;
  v_night_hours numeric := 0;
  v_organization_id uuid;
  v_wage_settings record;
  v_shift_start_minutes integer;
  v_shift_end_minutes integer;
  v_morning_start_minutes integer;
  v_morning_end_minutes integer;
  v_night_start_minutes integer;
  v_night_end_minutes integer;
  v_morning_overlap_minutes integer;
  v_night_overlap_minutes integer;
BEGIN
  -- Get company timezone
  v_company_timezone := get_company_timezone();
  
  -- Get current time in company timezone (Africa/Cairo)
  v_company_now := utc_to_company_time(NOW());
  v_company_date := v_company_now::date;
  v_company_time := v_company_now::time;
  
  -- Get the clock-in datetime and organization_id for the entry
  SELECT (clock_in_date + clock_in_time), organization_id 
  INTO v_clock_in_datetime, v_organization_id
  FROM public.timesheet_entries 
  WHERE id = p_entry_id;

  IF v_clock_in_datetime IS NULL THEN
    RAISE EXCEPTION 'Timesheet entry not found.';
  END IF;

  -- Calculate clock-out datetime in company timezone
  v_clock_out_datetime := (v_company_date + v_company_time);
  
  -- Calculate total hours worked
  v_total_hours := EXTRACT(EPOCH FROM (v_clock_out_datetime - v_clock_in_datetime)) / 3600.0;
  
  -- Ensure we don't have negative hours
  IF v_total_hours < 0 THEN
    v_total_hours := 0;
  END IF;

  -- Get wage settings for this organization (with fallback to global)
  SELECT * INTO v_wage_settings
  FROM public.wage_settings 
  WHERE organization_id = v_organization_id OR organization_id IS NULL
  ORDER BY (organization_id = v_organization_id) DESC, created_at ASC
  LIMIT 1;

  -- Calculate morning/night split if wage settings found
  IF v_wage_settings IS NOT NULL THEN
    -- Convert times to minutes from midnight
    v_shift_start_minutes := EXTRACT(HOUR FROM v_clock_in_datetime::time) * 60 + EXTRACT(MINUTE FROM v_clock_in_datetime::time);
    v_shift_end_minutes := EXTRACT(HOUR FROM v_clock_out_datetime::time) * 60 + EXTRACT(MINUTE FROM v_clock_out_datetime::time);
    
    -- Handle overnight shifts
    IF v_shift_end_minutes < v_shift_start_minutes THEN
      v_shift_end_minutes := v_shift_end_minutes + (24 * 60);
    END IF;
    
    -- Parse wage settings times to minutes
    v_morning_start_minutes := EXTRACT(HOUR FROM v_wage_settings.morning_start_time) * 60 + EXTRACT(MINUTE FROM v_wage_settings.morning_start_time);
    v_morning_end_minutes := EXTRACT(HOUR FROM v_wage_settings.morning_end_time) * 60 + EXTRACT(MINUTE FROM v_wage_settings.morning_end_time);
    v_night_start_minutes := EXTRACT(HOUR FROM v_wage_settings.night_start_time) * 60 + EXTRACT(MINUTE FROM v_wage_settings.night_start_time);
    v_night_end_minutes := EXTRACT(HOUR FROM v_wage_settings.night_end_time) * 60 + EXTRACT(MINUTE FROM v_wage_settings.night_end_time);
    
    -- Handle night period crossing midnight
    IF v_night_end_minutes < v_night_start_minutes THEN
      v_night_end_minutes := v_night_end_minutes + (24 * 60);
    END IF;
    
    -- Calculate morning overlap
    v_morning_overlap_minutes := GREATEST(0, LEAST(v_shift_end_minutes, v_morning_end_minutes) - GREATEST(v_shift_start_minutes, v_morning_start_minutes));
    v_morning_hours := v_morning_overlap_minutes / 60.0;
    
    -- Calculate night overlap
    v_night_overlap_minutes := GREATEST(0, LEAST(v_shift_end_minutes, v_night_end_minutes) - GREATEST(v_shift_start_minutes, v_night_start_minutes));
    v_night_hours := v_night_overlap_minutes / 60.0;
  END IF;

  -- Update the timesheet entry
  UPDATE public.timesheet_entries
  SET
    clock_out_date = v_company_date,
    clock_out_time = v_company_time,
    clock_out_location = p_clock_out_location,
    total_hours = v_total_hours,
    morning_hours = v_morning_hours,
    night_hours = v_night_hours,
    is_split_calculation = true
  WHERE id = p_entry_id
  RETURNING * INTO updated_entry;

  RETURN updated_entry;
END;
$function$;

-- Verify the setup
SELECT 'Migration applied successfully!' as status;
SELECT 'Company timezone: ' || get_company_timezone() as timezone_info;
SELECT 'Current UTC time: ' || NOW()::text as utc_time;
SELECT 'Current Cairo time: ' || utc_to_company_time(NOW())::text as cairo_time;

-- ============================================================================
-- STEP 2 (OPTIONAL): Fix old UTC entries - convert to Cairo time
-- ============================================================================
-- Run this AFTER the migration if you want to fix existing wrong entries

/*
-- Uncomment and run this to fix old entries:

UPDATE timesheet_entries
SET 
  clock_in_time = clock_in_time + interval '3 hours',
  clock_out_time = CASE 
    WHEN clock_out_time IS NOT NULL 
    THEN clock_out_time + interval '3 hours'
    ELSE NULL
  END
WHERE created_at < NOW()
  AND EXTRACT(HOUR FROM clock_in_time) < 21;

-- Verify the fix worked
SELECT 
  employee_name,
  clock_in_date,
  clock_in_time,
  EXTRACT(HOUR FROM clock_in_time) as hour_24,
  'Should be 23 for 11 PM, not 20' as note
FROM timesheet_entries
WHERE employee_name = 'Maha Khalil'
  AND clock_in_date = '2025-10-29'
ORDER BY clock_in_time DESC;
*/

