-- Update get_dashboard_stats to filter by organization_id

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(from_date text, to_date text, organization_id uuid)
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
  -- Count employees in the organization
  SELECT COUNT(*) INTO v_employee_count
  FROM public.employees e
  WHERE (organization_id IS NULL AND organization_id IS DISTINCT FROM organization_id) IS NOT TRUE
    AND (organization_id IS NULL OR e.organization_id = organization_id);

  -- Aggregate timesheet data within date range for the organization
  SELECT
    COALESCE(SUM(total_hours), 0),
    COALESCE(SUM(COALESCE(total_card_amount_split, total_card_amount_flat)), 0),
    COUNT(id)
  INTO
    v_total_hours,
    v_total_payroll,
    v_total_shifts
  FROM public.timesheet_entries te
  WHERE te.clock_in_date >= from_date::date
    AND te.clock_in_date <= to_date::date
    AND (organization_id IS NULL OR te.organization_id = organization_id);

  RETURN json_build_object(
    'employeeCount', v_employee_count,
    'totalHours', v_total_hours,
    'totalPayroll', v_total_payroll,
    'totalShifts', v_total_shifts
  );
END;
$function$;


