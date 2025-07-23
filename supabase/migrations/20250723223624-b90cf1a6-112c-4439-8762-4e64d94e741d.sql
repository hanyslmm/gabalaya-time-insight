-- Update the get_dashboard_stats function to count employees who worked in the period
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(from_date text, to_date text)
 RETURNS json
 LANGUAGE plpgsql
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
$function$