# Shift Task Management Feature - Implementation Plan
**Version:** 2.9.0  
**Date:** 2025-01-XX  
**Status:** Awaiting PO Approval

---

## 📋 Executive Summary

This document outlines the complete implementation plan for the "Shift Task Management" feature, which allows admins to create task libraries, assign tasks to roles/users, and track task completion during shifts. The feature integrates seamlessly with the existing clock-in flow without disrupting core functionality.

---

## 🗄️ PHASE 1: DATABASE SCHEMA DESIGN

### 1.1 Tables Overview

Four new tables are required, all organization-scoped with full RLS:

1. **`tasks`** - Master library of predefined tasks
2. **`role_tasks`** - Links tasks to roles (many-to-many)
3. **`user_tasks`** - Links tasks to specific users (many-to-many)
4. **`shift_task_completions`** - Logs task completions per shift

### 1.2 Table: `tasks`

**Purpose:** Stores the master library of predefined tasks that admins can create.

```sql
CREATE TABLE public.tasks (
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

-- Index for faster lookups
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX idx_tasks_is_active ON public.tasks(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**
```sql
-- Admins/Owners can manage all tasks in their organization
CREATE POLICY "Admins can manage tasks in their organization"
ON public.tasks
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
);

-- Employees can view active tasks in their organization
CREATE POLICY "Employees can view active tasks"
ON public.tasks
FOR SELECT
USING (
  is_active = true 
  AND organization_id IN (
    SELECT organization_id FROM public.employees 
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
    UNION
    SELECT current_organization_id FROM public.admin_users WHERE id = auth.uid()::text
  )
);
```

### 1.3 Table: `role_tasks`

**Purpose:** Links tasks to roles (many-to-many relationship). Uses `employee_roles.name` as the role identifier.

```sql
CREATE TABLE public.role_tasks (
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

-- Indexes
CREATE INDEX idx_role_tasks_organization_id ON public.role_tasks(organization_id);
CREATE INDEX idx_role_tasks_task_id ON public.role_tasks(task_id);
CREATE INDEX idx_role_tasks_role_name ON public.role_tasks(role_name);
CREATE INDEX idx_role_tasks_is_active ON public.role_tasks(is_active) WHERE is_active = true;

-- Foreign key constraint to ensure role exists
ALTER TABLE public.role_tasks
ADD CONSTRAINT role_tasks_role_fkey 
FOREIGN KEY (organization_id, role_name) 
REFERENCES public.employee_roles(organization_id, name) 
ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.role_tasks ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**
```sql
-- Admins can manage role-task assignments
CREATE POLICY "Admins can manage role tasks"
ON public.role_tasks
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
);

-- Employees can view role tasks for their role
CREATE POLICY "Employees can view role tasks for their role"
ON public.role_tasks
FOR SELECT
USING (
  is_active = true
  AND role_name IN (
    SELECT role FROM public.employees 
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
    AND organization_id = role_tasks.organization_id
  )
  AND organization_id IN (
    SELECT organization_id FROM public.employees 
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
    UNION
    SELECT current_organization_id FROM public.admin_users WHERE id = auth.uid()::text
  )
);
```

### 1.4 Table: `user_tasks`

**Purpose:** Links tasks to specific users (many-to-many relationship). Used for special cases where a task is assigned to a specific user rather than a role.

```sql
CREATE TABLE public.user_tasks (
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

-- Indexes
CREATE INDEX idx_user_tasks_organization_id ON public.user_tasks(organization_id);
CREATE INDEX idx_user_tasks_task_id ON public.user_tasks(task_id);
CREATE INDEX idx_user_tasks_employee_id ON public.user_tasks(employee_id);
CREATE INDEX idx_user_tasks_is_active ON public.user_tasks(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**
```sql
-- Admins can manage user-task assignments
CREATE POLICY "Admins can manage user tasks"
ON public.user_tasks
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
);

-- Employees can view their own assigned tasks
CREATE POLICY "Employees can view their own tasks"
ON public.user_tasks
FOR SELECT
USING (
  is_active = true
  AND employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
    AND organization_id = user_tasks.organization_id
  )
);
```

### 1.5 Table: `shift_task_completions`

**Purpose:** Logs which tasks were completed for which shift. Links to `timesheet_entries.id` to track completions per shift.

```sql
CREATE TABLE public.shift_task_completions (
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

-- Indexes for performance
CREATE INDEX idx_shift_task_completions_organization_id ON public.shift_task_completions(organization_id);
CREATE INDEX idx_shift_task_completions_timesheet_entry_id ON public.shift_task_completions(timesheet_entry_id);
CREATE INDEX idx_shift_task_completions_task_id ON public.shift_task_completions(task_id);
CREATE INDEX idx_shift_task_completions_employee_id ON public.shift_task_completions(employee_id);
CREATE INDEX idx_shift_task_completions_completed_at ON public.shift_task_completions(completed_at);

-- Enable RLS
ALTER TABLE public.shift_task_completions ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**
```sql
-- Admins can view all completions in their organization
CREATE POLICY "Admins can view all task completions"
ON public.shift_task_completions
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.admin_users 
    WHERE id = auth.uid()::text
    UNION
    SELECT id FROM public.organizations 
    WHERE EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()::text 
      AND (is_global_owner = true OR current_organization_id = organizations.id)
    )
  )
);

-- Employees can view and create their own completions
CREATE POLICY "Employees can manage their own task completions"
ON public.shift_task_completions
FOR ALL
USING (
  employee_id IN (
    SELECT id FROM public.employees 
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
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
    WHERE staff_id = (SELECT username FROM public.admin_users WHERE id = auth.uid()::text)
    AND organization_id = shift_task_completions.organization_id
  )
  AND timesheet_entry_id IN (
    SELECT id FROM public.timesheet_entries 
    WHERE employee_id = shift_task_completions.employee_id
  )
);
```

### 1.6 Migration File Structure

**File:** `supabase/migrations/202501XX00000_create_shift_task_management_tables.sql`

```sql
-- Migration: Create Shift Task Management Tables
-- Date: 2025-01-XX
-- Description: Creates tables for task library, role/user assignments, and completion tracking

BEGIN;

-- Create tasks table
-- (Full SQL from section 1.2)

-- Create role_tasks table
-- (Full SQL from section 1.3)

-- Create user_tasks table
-- (Full SQL from section 1.4)

-- Create shift_task_completions table
-- (Full SQL from section 1.5)

-- Add updated_at trigger for tasks table
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();

COMMIT;
```

---

## 🔧 PHASE 2: BACKEND FUNCTIONS & SECURITY

### 2.1 Function: `get_tasks_for_shift`

**Purpose:** Called after successful clock-in to retrieve all tasks assigned to the user (via role or user-specific assignment).

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION public.get_tasks_for_shift(
  p_timesheet_entry_id UUID,
  p_employee_id UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  task_description TEXT,
  assignment_type TEXT, -- 'role' or 'user'
  is_completed BOOLEAN,
  completed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_role TEXT;
  v_staff_id TEXT;
BEGIN
  -- Get employee role and staff_id
  SELECT role, staff_id INTO v_employee_role, v_staff_id
  FROM public.employees
  WHERE id = p_employee_id AND organization_id = p_organization_id;
  
  IF v_employee_role IS NULL THEN
    RETURN; -- Employee not found, return empty
  END IF;
  
  -- Return tasks assigned via role OR user-specific assignment
  RETURN QUERY
  WITH assigned_tasks AS (
    -- Tasks assigned to the employee's role
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'role'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.role_tasks rt ON rt.task_id = t.id
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND rt.organization_id = p_organization_id
      AND rt.is_active = true
      AND rt.role_name = v_employee_role
    
    UNION
    
    -- Tasks assigned specifically to this user
    SELECT DISTINCT
      t.id AS task_id,
      t.name AS task_name,
      t.description AS task_description,
      'user'::TEXT AS assignment_type
    FROM public.tasks t
    INNER JOIN public.user_tasks ut ON ut.task_id = t.id
    WHERE t.organization_id = p_organization_id
      AND t.is_active = true
      AND ut.organization_id = p_organization_id
      AND ut.is_active = true
      AND ut.employee_id = p_employee_id
  )
  SELECT 
    at.task_id,
    at.task_name,
    at.task_description,
    at.assignment_type,
    COALESCE(stc.completed_at IS NOT NULL, false) AS is_completed,
    stc.completed_at
  FROM assigned_tasks at
  LEFT JOIN public.shift_task_completions stc 
    ON stc.task_id = at.task_id 
    AND stc.timesheet_entry_id = p_timesheet_entry_id
  ORDER BY at.task_name;
END;
$$;
```

**Security:** Uses `SECURITY DEFINER` to bypass RLS, but validates organization_id and employee_id internally.

### 2.2 Function: `complete_shift_task`

**Purpose:** Marks a task as completed for a specific shift.

```sql
CREATE OR REPLACE FUNCTION public.complete_shift_task(
  p_timesheet_entry_id UUID,
  p_task_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get employee_id from timesheet entry
  SELECT employee_id INTO v_employee_id
  FROM public.timesheet_entries
  WHERE id = p_timesheet_entry_id
    AND organization_id = p_organization_id;
  
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Timesheet entry not found');
  END IF;
  
  -- Get current user ID (from auth context)
  SELECT id::UUID INTO v_user_id
  FROM public.admin_users
  WHERE username = (SELECT current_setting('request.jwt.claims', true)::json->>'username');
  
  -- Insert completion record (ON CONFLICT DO UPDATE to handle re-completion)
  INSERT INTO public.shift_task_completions (
    organization_id,
    timesheet_entry_id,
    task_id,
    employee_id,
    completed_by
  )
  VALUES (
    p_organization_id,
    p_timesheet_entry_id,
    p_task_id,
    v_employee_id,
    v_user_id
  )
  ON CONFLICT (timesheet_entry_id, task_id) 
  DO UPDATE SET 
    completed_at = now(),
    completed_by = v_user_id
  RETURNING id INTO v_result;
  
  RETURN jsonb_build_object('success', true, 'completion_id', v_result);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

### 2.3 Function: `uncomplete_shift_task`

**Purpose:** Removes a task completion (allows unchecking).

```sql
CREATE OR REPLACE FUNCTION public.uncomplete_shift_task(
  p_timesheet_entry_id UUID,
  p_task_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  -- Verify timesheet entry belongs to organization
  SELECT employee_id INTO v_employee_id
  FROM public.timesheet_entries
  WHERE id = p_timesheet_entry_id
    AND organization_id = p_organization_id;
  
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Timesheet entry not found');
  END IF;
  
  -- Delete completion record
  DELETE FROM public.shift_task_completions
  WHERE timesheet_entry_id = p_timesheet_entry_id
    AND task_id = p_task_id
    AND organization_id = p_organization_id;
  
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

### 2.4 Function: `get_task_performance_report`

**Purpose:** Returns task completion statistics for the performance report page.

```sql
CREATE OR REPLACE FUNCTION public.get_task_performance_report(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_employee_id UUID DEFAULT NULL -- Optional filter
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_staff_id TEXT,
  employee_role TEXT,
  total_tasks_assigned INTEGER,
  total_tasks_completed INTEGER,
  completion_rate DECIMAL(5,2),
  shifts_with_tasks INTEGER,
  shifts_completed_all_tasks INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH shift_tasks AS (
    -- Get all tasks assigned to each employee for their shifts
    SELECT DISTINCT
      te.id AS timesheet_entry_id,
      te.employee_id,
      t.id AS task_id,
      t.name AS task_name
    FROM public.timesheet_entries te
    INNER JOIN public.employees e ON e.id = te.employee_id
    CROSS JOIN LATERAL (
      -- Tasks via role
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.role_tasks rt ON rt.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND rt.organization_id = p_organization_id
        AND rt.is_active = true
        AND rt.role_name = e.role
      
      UNION
      
      -- Tasks via user assignment
      SELECT t.id, t.name
      FROM public.tasks t
      INNER JOIN public.user_tasks ut ON ut.task_id = t.id
      WHERE t.organization_id = p_organization_id
        AND t.is_active = true
        AND ut.organization_id = p_organization_id
        AND ut.is_active = true
        AND ut.employee_id = e.id
    ) t
    WHERE te.organization_id = p_organization_id
      AND te.clock_in_date >= p_start_date
      AND te.clock_in_date <= p_end_date
      AND (p_employee_id IS NULL OR te.employee_id = p_employee_id)
  ),
  completions AS (
    SELECT 
      st.timesheet_entry_id,
      st.employee_id,
      st.task_id,
      CASE WHEN stc.id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
    FROM shift_tasks st
    LEFT JOIN public.shift_task_completions stc 
      ON stc.timesheet_entry_id = st.timesheet_entry_id
      AND stc.task_id = st.task_id
  )
  SELECT 
    e.id AS employee_id,
    e.full_name AS employee_name,
    e.staff_id AS employee_staff_id,
    e.role AS employee_role,
    COUNT(DISTINCT c.task_id)::INTEGER AS total_tasks_assigned,
    SUM(c.is_completed)::INTEGER AS total_tasks_completed,
    CASE 
      WHEN COUNT(DISTINCT c.task_id) > 0 
      THEN ROUND((SUM(c.is_completed)::DECIMAL / COUNT(DISTINCT c.task_id)) * 100, 2)
      ELSE 0::DECIMAL
    END AS completion_rate,
    COUNT(DISTINCT c.timesheet_entry_id)::INTEGER AS shifts_with_tasks,
    COUNT(DISTINCT CASE 
      WHEN c.timesheet_entry_id IN (
        SELECT timesheet_entry_id 
        FROM completions 
        GROUP BY timesheet_entry_id 
        HAVING SUM(is_completed) = COUNT(*)
      ) THEN c.timesheet_entry_id 
    END)::INTEGER AS shifts_completed_all_tasks
  FROM public.employees e
  INNER JOIN completions c ON c.employee_id = e.id
  WHERE e.organization_id = p_organization_id
  GROUP BY e.id, e.full_name, e.staff_id, e.role
  ORDER BY e.full_name;
END;
$$;
```

---

## 💻 PHASE 3: FRONTEND IMPLEMENTATION

### 3.1 Modification: `ClockInOutPage.tsx`

**Location:** After successful clock-in (line ~620)

**Modification Strategy:**
1. After `await fetchTodayEntries()` succeeds (line 618)
2. Get the newly created timesheet entry ID from `currentEntry`
3. Call `get_tasks_for_shift` in a **non-blocking try-catch**
4. If tasks exist, show `ShiftTasksModal`
5. If no tasks or error, proceed normally (no modal)

**Code Addition:**
```typescript
// After line 618: await fetchTodayEntries();
// After line 619: await fetchTeamStatus();

// NEW CODE: Check for tasks (non-blocking)
try {
  if (currentEntry?.id && user) {
    const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
    
    // Get employee_id from current entry
    const { data: employeeData } = await supabase
      .from('employees')
      .select('id')
      .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name}`)
      .eq('organization_id', activeOrganizationId)
      .limit(1)
      .single();
    
    if (employeeData?.id) {
      // Call get_tasks_for_shift function
      const { data: tasksData, error: tasksError } = await supabase.rpc(
        'get_tasks_for_shift',
        {
          p_timesheet_entry_id: currentEntry.id,
          p_employee_id: employeeData.id,
          p_organization_id: activeOrganizationId
        }
      );
      
      if (!tasksError && tasksData && tasksData.length > 0) {
        // Tasks exist - show modal
        setShiftTasks(tasksData);
        setCurrentTimesheetEntryId(currentEntry.id);
        setShowShiftTasksModal(true);
      }
      // If no tasks or error, silently continue (non-blocking)
    }
  }
} catch (error) {
  // Log error but don't block user flow
  console.error('Error fetching shift tasks:', error);
  // User proceeds normally - no modal shown
}
```

**State Variables to Add:**
```typescript
const [shiftTasks, setShiftTasks] = useState<any[]>([]);
const [currentTimesheetEntryId, setCurrentTimesheetEntryId] = useState<string | null>(null);
const [showShiftTasksModal, setShowShiftTasksModal] = useState(false);
```

### 3.2 Component: `ShiftTasksModal.tsx`

**Location:** `src/components/ShiftTasksModal.tsx`

**Purpose:** Displays the task checklist for the current active shift.

**Features:**
- Shows list of assigned tasks
- Checkboxes to mark tasks as complete/incomplete
- Real-time updates via Supabase RPC calls
- i18n support (English/Arabic)
- RTL layout support
- Non-blocking - user can close modal and continue working

**Props Interface:**
```typescript
interface ShiftTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheetEntryId: string;
  tasks: Array<{
    task_id: string;
    task_name: string;
    task_description: string | null;
    assignment_type: 'role' | 'user';
    is_completed: boolean;
    completed_at: string | null;
  }>;
  organizationId: string;
}
```

**Key Functions:**
- `handleTaskToggle(taskId: string, isCompleted: boolean)` - Calls `complete_shift_task` or `uncomplete_shift_task`
- Real-time UI updates on completion
- Toast notifications for success/error

### 3.3 Page: `TaskManagementPage.tsx`

**Location:** `src/pages/TaskManagementPage.tsx`

**Route:** `/task-management` (admin/owner only)

**Structure:** Tabbed interface with two tabs:
1. **Tasks Library Tab** - CRUD for tasks
2. **Task Assignments Tab** - Assign tasks to roles/users

**Tasks Library Tab:**
- List of all tasks (with search/filter)
- Create new task (name, description)
- Edit existing task
- Delete/deactivate task
- Shows assignment count per task

**Task Assignments Tab:**
- Two sections:
  - **Assign to Roles:** Select role → Select tasks → Save
  - **Assign to Users:** Select user → Select tasks → Save
- Shows current assignments
- Ability to remove assignments

**i18n Keys Needed:**
- `taskManagement`, `tasksLibrary`, `taskAssignments`, `createTask`, `editTask`, `deleteTask`, `assignToRoles`, `assignToUsers`, etc.

### 3.4 Page: `TaskPerformancePage.tsx`

**Location:** `src/pages/TaskPerformancePage.tsx`

**Route:** `/task-performance` (admin/owner only)

**Features:**
- Date range selector (default: current month)
- Employee filter (optional)
- Table showing:
  - Employee name/ID/role
  - Total tasks assigned
  - Total tasks completed
  - Completion rate (%)
  - Shifts with tasks
  - Shifts completed all tasks
- Export to Excel functionality
- Charts/graphs (optional enhancement)

**Data Source:** Uses `get_task_performance_report` RPC function

**i18n Keys Needed:**
- `taskPerformance`, `taskPerformanceReport`, `completionRate`, `shiftsWithTasks`, etc.

### 3.5 Navigation Updates

**File:** `src/components/Layout.tsx`

**Addition:** Add navigation items for admin/owner:
```typescript
{
  name: t('taskManagement'),
  href: '/task-management',
  icon: ClipboardList, // or similar
  description: t('manageShiftTasks'),
  roles: ['admin', 'owner']
},
{
  name: t('taskPerformance'),
  href: '/task-performance',
  icon: BarChart3,
  description: t('viewTaskPerformance'),
  roles: ['admin', 'owner']
}
```

---

## 📝 PHASE 4: DETAILED TODO LIST

### Step 1: Database Migration
- [ ] Create migration file: `202501XX00000_create_shift_task_management_tables.sql`
- [ ] Add `tasks` table with RLS policies
- [ ] Add `role_tasks` table with RLS policies and foreign key to `employee_roles`
- [ ] Add `user_tasks` table with RLS policies
- [ ] Add `shift_task_completions` table with RLS policies
- [ ] Add indexes for performance
- [ ] Add `updated_at` trigger for `tasks` table
- [ ] Test migration locally
- [ ] Verify RLS policies work correctly

### Step 2: Backend Functions
- [ ] Create `get_tasks_for_shift` function
- [ ] Create `complete_shift_task` function
- [ ] Create `uncomplete_shift_task` function
- [ ] Create `get_task_performance_report` function
- [ ] Test all functions with sample data
- [ ] Verify security (organization scoping, user permissions)

### Step 3: Frontend - ShiftTasksModal Component
- [ ] Create `src/components/ShiftTasksModal.tsx`
- [ ] Implement task list display with checkboxes
- [ ] Implement task completion toggle logic
- [ ] Add i18n support (English/Arabic)
- [ ] Add RTL layout support
- [ ] Add loading states and error handling
- [ ] Add toast notifications
- [ ] Test modal functionality

### Step 4: Frontend - ClockInOutPage Integration
- [ ] Add state variables for tasks modal
- [ ] Modify `handleClockIn` to call `get_tasks_for_shift` after successful clock-in
- [ ] Wrap task fetching in try-catch (non-blocking)
- [ ] Test clock-in flow with tasks assigned
- [ ] Test clock-in flow without tasks assigned
- [ ] Test error handling (network failures, etc.)

### Step 5: Frontend - TaskManagementPage
- [ ] Create `src/pages/TaskManagementPage.tsx`
- [ ] Implement Tasks Library tab (CRUD)
- [ ] Implement Task Assignments tab (role/user assignments)
- [ ] Add search/filter functionality
- [ ] Add i18n support
- [ ] Add RTL layout support
- [ ] Test all CRUD operations
- [ ] Test assignment operations

### Step 6: Frontend - TaskPerformancePage
- [ ] Create `src/pages/TaskPerformancePage.tsx`
- [ ] Implement date range selector
- [ ] Implement employee filter
- [ ] Implement data table with performance metrics
- [ ] Add export to Excel functionality
- [ ] Add i18n support
- [ ] Add RTL layout support
- [ ] Test report generation

### Step 7: Navigation & Routing
- [ ] Add navigation items to `Layout.tsx`
- [ ] Add routes to `App.tsx` or router config
- [ ] Add route guards (admin/owner only)
- [ ] Test navigation flow

### Step 8: Translation Keys
- [ ] Add all English translation keys to `public/locales/en/translation.json`
- [ ] Add all Arabic translation keys to `public/locales/ar/translation.json`
- [ ] Verify all UI strings are translated

### Step 9: Testing & QA
- [ ] Test complete flow: Create task → Assign to role → Clock in → Complete tasks
- [ ] Test user-specific task assignments
- [ ] Test task performance report
- [ ] Test error scenarios (network failures, missing data)
- [ ] Test RTL layout in Arabic
- [ ] Test organization scoping (multi-tenant)
- [ ] Performance testing (large task lists, many completions)

### Step 10: Documentation & Deployment
- [ ] Update version to 2.10.0 in Settings page
- [ ] Add increment note to Settings → System tab
- [ ] Create user documentation (if needed)
- [ ] Deploy migration to production
- [ ] Deploy frontend changes
- [ ] Monitor for errors

---

## 🔒 SECURITY CONSIDERATIONS

1. **Organization Scoping:** All tables include `organization_id` and RLS policies ensure users can only access data from their organization.

2. **RLS Policies:** Comprehensive RLS policies on all tables:
   - Admins can manage all data in their organization
   - Employees can only view/complete their own tasks
   - No cross-organization data leakage

3. **Function Security:** All RPC functions use `SECURITY DEFINER` but validate organization_id and user permissions internally.

4. **Input Validation:** All function parameters are validated (UUIDs, dates, etc.)

5. **SQL Injection Prevention:** All queries use parameterized statements.

---

## 🎯 ACCEPTANCE CRITERIA CHECKLIST

- [x] Database schema designed with 4 tables
- [x] All tables organization-scoped with RLS
- [x] Backend functions designed (get, complete, uncomplete, report)
- [x] Frontend modification plan for ClockInOutPage (non-blocking)
- [x] ShiftTasksModal component plan
- [x] TaskManagementPage plan (CRUD + assignments)
- [x] TaskPerformancePage plan (reporting)
- [x] Full TODO list created
- [x] Security considerations documented

---

## 📌 NOTES & CONSIDERATIONS

1. **Clock-In Priority:** The task-checking logic is completely decoupled from clock-in. Even if task fetching fails, clock-in succeeds.

2. **Performance:** Indexes are added to all foreign keys and frequently queried columns.

3. **Scalability:** The design supports unlimited tasks, roles, and users per organization.

4. **Backward Compatibility:** Existing clock-in flow remains unchanged if no tasks are assigned.

5. **Future Enhancements:** The schema supports future features like:
   - Task templates
   - Recurring tasks
   - Task dependencies
   - Task deadlines
   - Task categories/tags

---

## ⏸️ PO ACTION REQUIRED

**This plan is complete and ready for review.**

Please review the:
1. Database schema (Section 1)
2. Backend functions (Section 2)
3. Frontend implementation plan (Section 3)
4. Detailed TODO list (Section 4)

**Awaiting PO approval before proceeding with implementation.**


