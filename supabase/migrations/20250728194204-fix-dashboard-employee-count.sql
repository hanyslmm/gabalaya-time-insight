-- Fix dashboard employee count to show total active employees instead of just those who worked in the period
-- This addresses the issue where "Current Employees" shows only employees who worked during the selected period

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
  -- Get total count of all employees in the system (active staff members)
  -- This represents the actual number of employees in the company
  SELECT COUNT(*) INTO v_employee_count 
  FROM public.employees;

  -- Aggregate timesheet data within the specified date range
  -- These metrics are still period-specific as they should be
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