-- Update clock_out function to automatically calculate morning/night hours
-- This ensures hours are split immediately when employees clock out

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
  
  -- Get current time in company timezone
  v_company_now := utc_to_company_time(NOW());
  v_company_date := v_company_now::date;
  v_company_time := v_company_now::time;
  
  -- Get the clock-in datetime and organization_id for the entry
  SELECT (clock_in_date + clock_in_time), organization_id INTO v_clock_in_datetime, v_organization_id
  FROM public.timesheet_entries WHERE id = p_entry_id;

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

  -- Get wage settings for this organization (with fallback)
  SELECT * INTO v_wage_settings
  FROM public.wage_settings 
  WHERE organization_id = v_organization_id OR organization_id IS NULL
  ORDER BY (organization_id = v_organization_id) DESC, created_at ASC
  LIMIT 1;

  -- Calculate morning/night split if wage settings found
  IF v_wage_settings IS NOT NULL THEN
    -- Convert times to minutes from midnight for easier calculation
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

  -- Update the timesheet entry with all calculated values
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
