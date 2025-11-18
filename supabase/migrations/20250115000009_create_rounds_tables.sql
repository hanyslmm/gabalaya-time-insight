-- Migration: Create Rounds Tables for Task Management
-- Date: 2025-01-15
-- Description: Creates tables for grouping tasks into rounds and assigning rounds to employees with day-based schedules
-- Version: 2.10.0

BEGIN;

-- ============================================================================
-- TABLE: rounds
-- Purpose: Stores round definitions (groups of tasks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT rounds_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: round_tasks
-- Purpose: Links tasks to rounds (many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  round_id UUID NOT NULL,
  task_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT round_tasks_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT round_tasks_round_fk FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE,
  CONSTRAINT round_tasks_task_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT round_tasks_unique UNIQUE (round_id, task_id)
);

-- ============================================================================
-- TABLE: round_assignments
-- Purpose: Assigns rounds to employees or roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  round_id UUID NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('role', 'user')),
  role_name TEXT, -- For role assignments
  employee_id UUID, -- For user assignments
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT round_assignments_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT round_assignments_round_fk FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE,
  CONSTRAINT round_assignments_employee_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT round_assignments_type_check CHECK (
    (assignment_type = 'role' AND role_name IS NOT NULL AND employee_id IS NULL) OR
    (assignment_type = 'user' AND employee_id IS NOT NULL AND role_name IS NULL)
  )
);

-- ============================================================================
-- TABLE: round_schedules
-- Purpose: Stores day-based schedules for rounds (e.g., Round 1 → Saturday, Monday, Wednesday)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  round_assignment_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, ..., 6=Saturday
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT round_schedules_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT round_schedules_assignment_fk FOREIGN KEY (round_assignment_id) REFERENCES public.round_assignments(id) ON DELETE CASCADE,
  CONSTRAINT round_schedules_unique UNIQUE (round_assignment_id, day_of_week)
);

-- ============================================================================
-- TABLE: round_date_overrides
-- Purpose: Overrides day-based schedules with specific date assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  round_assignment_id UUID NOT NULL,
  override_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT round_date_overrides_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT round_date_overrides_assignment_fk FOREIGN KEY (round_assignment_id) REFERENCES public.round_assignments(id) ON DELETE CASCADE,
  CONSTRAINT round_date_overrides_unique UNIQUE (round_assignment_id, override_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rounds_organization ON public.rounds(organization_id);
CREATE INDEX IF NOT EXISTS idx_rounds_active ON public.rounds(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_round_tasks_round ON public.round_tasks(round_id);
CREATE INDEX IF NOT EXISTS idx_round_tasks_task ON public.round_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_round_tasks_organization ON public.round_tasks(organization_id);

CREATE INDEX IF NOT EXISTS idx_round_assignments_round ON public.round_assignments(round_id);
CREATE INDEX IF NOT EXISTS idx_round_assignments_role ON public.round_assignments(organization_id, assignment_type, role_name) WHERE assignment_type = 'role';
CREATE INDEX IF NOT EXISTS idx_round_assignments_employee ON public.round_assignments(organization_id, assignment_type, employee_id) WHERE assignment_type = 'user';
CREATE INDEX IF NOT EXISTS idx_round_assignments_active ON public.round_assignments(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_round_schedules_assignment ON public.round_schedules(round_assignment_id);
CREATE INDEX IF NOT EXISTS idx_round_schedules_day ON public.round_schedules(round_assignment_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_round_date_overrides_assignment ON public.round_date_overrides(round_assignment_id);
CREATE INDEX IF NOT EXISTS idx_round_date_overrides_date ON public.round_date_overrides(round_assignment_id, override_date);
CREATE INDEX IF NOT EXISTS idx_round_date_overrides_active ON public.round_date_overrides(organization_id, is_active, override_date);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Rounds table: Permissive RLS (security at app level)
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on rounds" ON public.rounds;
CREATE POLICY "Allow all operations on rounds"
ON public.rounds
FOR ALL
USING (true)
WITH CHECK (true);

-- Round tasks table: Permissive RLS
ALTER TABLE public.round_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on round_tasks" ON public.round_tasks;
CREATE POLICY "Allow all operations on round_tasks"
ON public.round_tasks
FOR ALL
USING (true)
WITH CHECK (true);

-- Round assignments table: Permissive RLS
ALTER TABLE public.round_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on round_assignments" ON public.round_assignments;
CREATE POLICY "Allow all operations on round_assignments"
ON public.round_assignments
FOR ALL
USING (true)
WITH CHECK (true);

-- Round schedules table: Permissive RLS
ALTER TABLE public.round_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on round_schedules" ON public.round_schedules;
CREATE POLICY "Allow all operations on round_schedules"
ON public.round_schedules
FOR ALL
USING (true)
WITH CHECK (true);

-- Round date overrides table: Permissive RLS
ALTER TABLE public.round_date_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on round_date_overrides" ON public.round_date_overrides;
CREATE POLICY "Allow all operations on round_date_overrides"
ON public.round_date_overrides
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;

