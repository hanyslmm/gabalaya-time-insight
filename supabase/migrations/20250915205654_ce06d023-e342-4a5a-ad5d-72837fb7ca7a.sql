-- Fix the remaining function that's missing search_path
CREATE OR REPLACE FUNCTION public.get_monthly_summary(target_year integer, target_month integer)
RETURNS TABLE(total_income numeric, total_expense numeric, net_profit numeric, transaction_count integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;