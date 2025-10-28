-- Add pay period configuration to company_settings table
-- Supports two modes: 'fixed_day' and 'month_dynamic'

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS pay_period_mode TEXT DEFAULT 'fixed_day' CHECK (pay_period_mode IN ('fixed_day', 'month_dynamic')),
ADD COLUMN IF NOT EXISTS pay_period_end_day INTEGER DEFAULT 28 CHECK (pay_period_end_day >= 1 AND pay_period_end_day <= 31);

-- Add comment
COMMENT ON COLUMN company_settings.pay_period_mode IS 'Pay period calculation mode: fixed_day (ends on specific day) or month_dynamic (full calendar month)';
COMMENT ON COLUMN company_settings.pay_period_end_day IS 'Day of month when pay period ends (only used in fixed_day mode)';

-- Update existing rows with default values
UPDATE company_settings
SET pay_period_mode = 'fixed_day',
    pay_period_end_day = 28
WHERE pay_period_mode IS NULL;

