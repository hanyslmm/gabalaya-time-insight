-- Migration: Create Shift Task Management Tables
-- Date: 2025-01-15
-- Description: Creates tables for task library, role/user assignments, and completion tracking
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- TABLE 1: tasks
-- Purpose: Master library of predefined tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.admin_users(id),
  
  -- Ensure unique task names per organization
  CONSTRAINT tasks_org_name_unique UNIQUE (organization_id, name)
);

-- Indexes for tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON public.tasks(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks table
DROP POLICY IF EXISTS "Admins can manage tasks in their organization" ON public.tasks;
CREATE POLICY "Admins can manage tasks in their organization"
ON public.tasks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = tasks.organization_id
      OR current_organization_id = tasks.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Employees can view active tasks" ON public.tasks;
CREATE POLICY "Employees can view active tasks"
ON public.tasks
FOR SELECT
USING (
  is_active = true 
  AND organization_id IN (
    SELECT organization_id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    UNION
    SELECT current_organization_id FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
  )
);

-- ============================================================================
-- TABLE 2: role_tasks
-- Purpose: Links tasks to roles (many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL, -- References employee_roles.name
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.admin_users(id),
  
  -- Ensure unique task-role combinations per organization
  CONSTRAINT role_tasks_org_task_role_unique UNIQUE (organization_id, task_id, role_name)
);

-- Indexes for role_tasks table
CREATE INDEX IF NOT EXISTS idx_role_tasks_organization_id ON public.role_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_tasks_task_id ON public.role_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_role_tasks_role_name ON public.role_tasks(role_name);
CREATE INDEX IF NOT EXISTS idx_role_tasks_is_active ON public.role_tasks(is_active) WHERE is_active = true;

-- Foreign key constraint to ensure role exists in employee_roles
-- Note: This uses a composite foreign key (organization_id, role_name)
ALTER TABLE public.role_tasks
DROP CONSTRAINT IF EXISTS role_tasks_role_fkey;

-- Create the foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_tasks_role_fkey'
  ) THEN
    ALTER TABLE public.role_tasks
    ADD CONSTRAINT role_tasks_role_fkey 
    FOREIGN KEY (organization_id, role_name) 
    REFERENCES public.employee_roles(organization_id, name) 
    ON DELETE CASCADE;
  END IF;
END$$;

-- Enable RLS
ALTER TABLE public.role_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_tasks table
DROP POLICY IF EXISTS "Admins can manage role tasks" ON public.role_tasks;
CREATE POLICY "Admins can manage role tasks"
ON public.role_tasks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = role_tasks.organization_id
      OR current_organization_id = role_tasks.organization_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = role_tasks.organization_id
      OR current_organization_id = role_tasks.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Employees can view role tasks for their role" ON public.role_tasks;
CREATE POLICY "Employees can view role tasks for their role"
ON public.role_tasks
FOR SELECT
USING (
  is_active = true
  AND role_name IN (
    SELECT role FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    AND organization_id = role_tasks.organization_id
  )
  AND organization_id IN (
    SELECT organization_id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    UNION
    SELECT current_organization_id FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
  )
);

-- ============================================================================
-- TABLE 3: user_tasks
-- Purpose: Links tasks to specific users (many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.admin_users(id),
  
  -- Ensure unique task-user combinations per organization
  CONSTRAINT user_tasks_org_task_employee_unique UNIQUE (organization_id, task_id, employee_id)
);

-- Indexes for user_tasks table
CREATE INDEX IF NOT EXISTS idx_user_tasks_organization_id ON public.user_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task_id ON public.user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_employee_id ON public.user_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_is_active ON public.user_tasks(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tasks table
DROP POLICY IF EXISTS "Admins can manage user tasks" ON public.user_tasks;
CREATE POLICY "Admins can manage user tasks"
ON public.user_tasks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = user_tasks.organization_id
      OR current_organization_id = user_tasks.organization_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = user_tasks.organization_id
      OR current_organization_id = user_tasks.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Employees can view their own tasks" ON public.user_tasks;
CREATE POLICY "Employees can view their own tasks"
ON public.user_tasks
FOR SELECT
USING (
  is_active = true
  AND employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    AND organization_id = user_tasks.organization_id
  )
);

-- ============================================================================
-- TABLE 4: shift_task_completions
-- Purpose: Logs which tasks were completed for which shift
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shift_task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timesheet_entry_id UUID NOT NULL REFERENCES public.timesheet_entries(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES public.admin_users(id), -- The user who marked it complete
  
  -- Ensure one completion record per task per shift
  CONSTRAINT shift_task_completions_unique UNIQUE (timesheet_entry_id, task_id)
);

-- Indexes for shift_task_completions table
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_organization_id ON public.shift_task_completions(organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_timesheet_entry_id ON public.shift_task_completions(timesheet_entry_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_task_id ON public.shift_task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_employee_id ON public.shift_task_completions(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_completions_completed_at ON public.shift_task_completions(completed_at);

-- Enable RLS
ALTER TABLE public.shift_task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_task_completions table
DROP POLICY IF EXISTS "Admins can view all task completions" ON public.shift_task_completions;
CREATE POLICY "Admins can view all task completions"
ON public.shift_task_completions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE username = (auth.jwt() ->> 'username'::text)
    AND (
      is_global_owner = true 
      OR organization_id = shift_task_completions.organization_id
      OR current_organization_id = shift_task_completions.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Employees can manage their own task completions" ON public.shift_task_completions;
CREATE POLICY "Employees can manage their own task completions"
ON public.shift_task_completions
FOR ALL
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    AND organization_id = shift_task_completions.organization_id
  )
  AND timesheet_entry_id IN (
    SELECT id FROM public.timesheet_entries 
    WHERE employee_id = shift_task_completions.employee_id
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (auth.jwt() ->> 'username'::text)
    AND organization_id = shift_task_completions.organization_id
  )
  AND timesheet_entry_id IN (
    SELECT id FROM public.timesheet_entries 
    WHERE employee_id = shift_task_completions.employee_id
  )
);

-- ============================================================================
-- TRIGGER: Update updated_at for tasks table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();

COMMIT;

