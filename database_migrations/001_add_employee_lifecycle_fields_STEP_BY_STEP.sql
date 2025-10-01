-- ============================================
-- STEP-BY-STEP MIGRATION GUIDE
-- Run each section ONE AT A TIME in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Add the new columns
-- Copy and run this first:
-- ============================================
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS termination_date DATE NULL,
ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS eligible_for_rehire BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS termination_notes TEXT NULL,
ADD COLUMN IF NOT EXISTS last_organization_id UUID NULL;

-- ============================================
-- STEP 2: Create indexes for performance
-- After Step 1 succeeds, run this:
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_organization_status ON employees(organization_id, status);

-- ============================================
-- STEP 3: Add foreign key constraint
-- After Step 2 succeeds, run this:
-- ============================================
ALTER TABLE employees
ADD CONSTRAINT fk_employees_last_organization
FOREIGN KEY (last_organization_id) 
REFERENCES organizations(id) 
ON DELETE SET NULL;

-- ============================================
-- STEP 4: Update existing data
-- After Step 3 succeeds, run this:
-- ============================================
UPDATE employees 
SET status = 'active' 
WHERE status IS NULL;

-- ============================================
-- STEP 5: Add documentation comments
-- After Step 4 succeeds, run this:
-- ============================================
COMMENT ON COLUMN employees.status IS 'Employee status: active, terminated, on_leave, suspended';
COMMENT ON COLUMN employees.termination_reason IS 'Reason for termination: absenteeism, admin_error, availability_change, business_conditions, end_contract, fired, health_reasons, moved, performance, personal_reasons, policy_violation, position_eliminated, quit, school, seasonal_end, other';
COMMENT ON COLUMN employees.eligible_for_rehire IS 'Whether this employee can be rehired in the future';
COMMENT ON COLUMN employees.last_organization_id IS 'Organization the employee belonged to before termination (for rehiring to different org)';

-- ============================================
-- ✅ DONE! All steps completed successfully!
-- ============================================

