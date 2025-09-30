-- Migration: Add Employee Lifecycle Management Fields
-- Date: 2025-09-30
-- Purpose: Enable employee termination, status tracking, and rehiring

-- Add new columns to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS termination_date DATE NULL,
ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS eligible_for_rehire BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS termination_notes TEXT NULL,
ADD COLUMN IF NOT EXISTS last_organization_id UUID NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_organization_status ON employees(organization_id, status);

-- Add foreign key for last_organization_id
ALTER TABLE employees
ADD CONSTRAINT fk_employees_last_organization
FOREIGN KEY (last_organization_id) 
REFERENCES organizations(id) 
ON DELETE SET NULL;

-- Update existing employees to have 'active' status
UPDATE employees 
SET status = 'active' 
WHERE status IS NULL;

-- Add comment to document the status values
COMMENT ON COLUMN employees.status IS 'Employee status: active, terminated, on_leave, suspended';
COMMENT ON COLUMN employees.termination_reason IS 'Reason for termination: absenteeism, admin_error, availability_change, business_conditions, end_contract, fired, health_reasons, moved, performance, personal_reasons, policy_violation, position_eliminated, quit, school, seasonal_end, other';
COMMENT ON COLUMN employees.eligible_for_rehire IS 'Whether this employee can be rehired in the future';
COMMENT ON COLUMN employees.last_organization_id IS 'Organization the employee belonged to before termination (for rehiring to different org)';
