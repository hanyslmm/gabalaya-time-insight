-- Separate Permission Level from Roles
-- This migration separates permission levels (employee/admin/owner) from job roles (Champion, Captain, etc.)
-- and enables multiple roles per employee with per-role wage rates

-- Step 1: Add permission_level column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS permission_level TEXT DEFAULT 'employee' CHECK (permission_level IN ('employee', 'admin', 'owner'));

-- Step 2: Migrate existing data - extract permission level from role field
-- If role is 'admin' or 'owner', set permission_level accordingly
-- Otherwise, set permission_level to 'employee'
UPDATE public.employees 
SET permission_level = CASE 
  WHEN LOWER(role) IN ('admin', 'administrator') THEN 'admin'
  WHEN LOWER(role) = 'owner' THEN 'owner'
  ELSE 'employee'
END
WHERE permission_level IS NULL OR permission_level = 'employee';

-- Step 3: Create employee_role_assignments table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.employee_role_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.employee_roles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, role_id)
);

-- Enable RLS on employee_role_assignments
ALTER TABLE public.employee_role_assignments ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policy (security enforced at application level)
CREATE POLICY "Manage employee role assignments" ON public.employee_role_assignments
FOR ALL USING (true) WITH CHECK (true);

-- Step 4: Create employee_role_wages table for per-role wage rates
CREATE TABLE IF NOT EXISTS public.employee_role_wages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.employee_roles(id) ON DELETE CASCADE,
  morning_wage_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  night_wage_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, role_id)
);

-- Enable RLS on employee_role_wages
ALTER TABLE public.employee_role_wages ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policy (security enforced at application level)
CREATE POLICY "Manage employee role wages" ON public.employee_role_wages
FOR ALL USING (true) WITH CHECK (true);

-- Step 5: Migrate existing role data to employee_role_assignments
-- For each employee, if their current role is a valid job role (not admin/owner),
-- assign them to that role in employee_roles table
DO $$
DECLARE
  emp_record RECORD;
  role_record RECORD;
  org_id_val UUID;
BEGIN
  FOR emp_record IN 
    SELECT e.id, e.role, e.organization_id, e.morning_wage_rate, e.night_wage_rate
    FROM public.employees e
    WHERE e.role IS NOT NULL 
      AND LOWER(e.role) NOT IN ('admin', 'administrator', 'owner', 'employee')
  LOOP
    -- Find matching role in employee_roles table
    SELECT er.id INTO role_record
    FROM public.employee_roles er
    WHERE er.name = emp_record.role
      AND er.organization_id = emp_record.organization_id
    LIMIT 1;
    
    -- If role found, create assignment
    IF role_record.id IS NOT NULL THEN
      -- Insert role assignment
      INSERT INTO public.employee_role_assignments (employee_id, role_id, is_active)
      VALUES (emp_record.id, role_record.id, true)
      ON CONFLICT (employee_id, role_id) DO NOTHING;
      
      -- Insert wage rates for this role if they exist
      IF emp_record.morning_wage_rate IS NOT NULL OR emp_record.night_wage_rate IS NOT NULL THEN
        INSERT INTO public.employee_role_wages (employee_id, role_id, morning_wage_rate, night_wage_rate)
        VALUES (
          emp_record.id, 
          role_record.id,
          COALESCE(emp_record.morning_wage_rate, 0),
          COALESCE(emp_record.night_wage_rate, 0)
        )
        ON CONFLICT (employee_id, role_id) 
        DO UPDATE SET 
          morning_wage_rate = EXCLUDED.morning_wage_rate,
          night_wage_rate = EXCLUDED.night_wage_rate;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_role_assignments_employee_id 
ON public.employee_role_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_role_assignments_role_id 
ON public.employee_role_assignments(role_id);

CREATE INDEX IF NOT EXISTS idx_employee_role_wages_employee_id 
ON public.employee_role_wages(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_role_wages_role_id 
ON public.employee_role_wages(role_id);

-- Step 7: Add trigger to update updated_at columns
CREATE TRIGGER update_employee_role_assignments_updated_at 
BEFORE UPDATE ON public.employee_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_role_wages_updated_at 
BEFORE UPDATE ON public.employee_role_wages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Create helper function to get employee's active roles
CREATE OR REPLACE FUNCTION public.get_employee_active_roles(p_employee_id UUID)
RETURNS TABLE(role_id UUID, role_name TEXT, morning_wage_rate DECIMAL, night_wage_rate DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    er.id as role_id,
    er.name as role_name,
    COALESCE(erw.morning_wage_rate, 0) as morning_wage_rate,
    COALESCE(erw.night_wage_rate, 0) as night_wage_rate
  FROM public.employee_role_assignments era
  INNER JOIN public.employee_roles er ON era.role_id = er.id
  LEFT JOIN public.employee_role_wages erw ON era.employee_id = erw.employee_id AND era.role_id = erw.role_id
  WHERE era.employee_id = p_employee_id
    AND era.is_active = true
  ORDER BY er.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create helper function to get employee's current role (for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_employee_current_role(p_employee_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_role_name TEXT;
BEGIN
  SELECT er.name INTO current_role_name
  FROM public.employee_role_assignments era
  INNER JOIN public.employee_roles er ON era.role_id = er.id
  WHERE era.employee_id = p_employee_id
    AND era.is_active = true
  ORDER BY era.assigned_at DESC
  LIMIT 1;
  
  RETURN COALESCE(current_role_name, 'Employee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We keep the old 'role' column for backward compatibility during migration period
-- It will be deprecated and removed in a future migration after all code is updated

