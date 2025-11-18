import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, User, ClipboardList, Save, X, TrendingUp, Download, CheckCircle2, Calendar, Clock, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface Task {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string;
  created_at: string;
}

interface Role {
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
  staff_id: string;
  role: string;
}

interface RoleTask {
  id: string;
  task_id: string;
  role_name: string;
  is_active: boolean;
}

interface UserTask {
  id: string;
  task_id: string;
  employee_id: string;
  is_active: boolean;
}

interface TaskPerformanceData {
  employee_id: string;
  employee_name: string;
  employee_staff_id: string;
  employee_role: string;
  total_tasks_assigned: number;
  total_tasks_completed: number;
  completion_rate: number;
  shifts_with_tasks: number;
  shifts_completed_all_tasks: number;
}

interface Round {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string;
  created_at: string;
}

interface RoundTask {
  id: string;
  round_id: string;
  task_id: string;
  display_order: number;
}

interface RoundAssignment {
  id: string;
  round_id: string;
  assignment_type: 'role' | 'user';
  role_name: string | null;
  employee_id: string | null;
  is_active: boolean;
}

interface RoundSchedule {
  id: string;
  round_assignment_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

interface RoundDateOverride {
  id: string;
  round_assignment_id: string;
  override_date: string; // DATE format
  is_active: boolean;
}

const TaskManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskIsActive, setTaskIsActive] = useState(true);

  // Assignment state
  const [selectedTaskForAssignment, setSelectedTaskForAssignment] = useState<Task | null>(null);
  const [assignmentType, setAssignmentType] = useState<'role' | 'user'>('role');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');

  // Performance filters
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Rounds state
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [roundName, setRoundName] = useState('');
  const [roundDescription, setRoundDescription] = useState('');
  const [roundIsActive, setRoundIsActive] = useState(true);
  const [selectedRoundForTasks, setSelectedRoundForTasks] = useState<Round | null>(null);
  const [selectedTasksForRound, setSelectedTasksForRound] = useState<string[]>([]);
  const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);

  // Round assignment state
  const [selectedRoundForAssignment, setSelectedRoundForAssignment] = useState<Round | null>(null);
  const [roundAssignmentType, setRoundAssignmentType] = useState<'role' | 'user'>('role');
  const [selectedRoundRole, setSelectedRoundRole] = useState<string>('');
  const [selectedRoundEmployee, setSelectedRoundEmployee] = useState<string>('');
  const [selectedRoundEmployees, setSelectedRoundEmployees] = useState<string[]>([]); // For multi-select
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0-6 for Sunday-Saturday
  const [selectedAssignmentForOverride, setSelectedAssignmentForOverride] = useState<RoundAssignment | null>(null);
  const [overrideDate, setOverrideDate] = useState<Date | undefined>(undefined);

  // Filters & Search state
  const [roundSearchTerm, setRoundSearchTerm] = useState('');
  const [roundStatusFilter, setRoundStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roundSortBy, setRoundSortBy] = useState<'name' | 'created' | 'tasks'>('created');

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['employee-roles', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('employee_roles')
        .select('name')
        .eq('organization_id', activeOrganizationId)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, staff_id, role')
        .eq('organization_id', activeOrganizationId)
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch role tasks
  const { data: roleTasks = [] } = useQuery<RoleTask[]>({
    queryKey: ['role-tasks', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_tasks')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch user tasks
  const { data: userTasks = [] } = useQuery<UserTask[]>({
    queryKey: ['user-tasks', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_tasks')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch task performance data
  const { data: performanceData = [], isLoading: performanceLoading } = useQuery<TaskPerformanceData[]>({
    queryKey: ['task-performance', activeOrganizationId, dateRange.from, dateRange.to, selectedEmployeeId],
    enabled: !!activeOrganizationId && !!dateRange.from && !!dateRange.to,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_task_performance_report', {
        p_organization_id: activeOrganizationId,
        p_start_date: format(dateRange.from, 'yyyy-MM-dd'),
        p_end_date: format(dateRange.to, 'yyyy-MM-dd'),
        p_employee_id: selectedEmployeeId === 'all' ? null : selectedEmployeeId,
      });

      if (error) {
        console.error('Error fetching task performance:', error);
        throw error;
      }

      return (data || []) as TaskPerformanceData[];
    }
  });

  // Create/Update task mutation
  const taskMutation = useMutation({
    mutationFn: async () => {
      if (!taskName.trim()) {
        throw new Error(t('taskNameRequired') || 'Task name is required');
      }

      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            name: taskName.trim(),
            description: taskDescription.trim() || null,
            is_active: taskIsActive,
          })
          .eq('id', editingTask.id);
        if (error) throw error;
      } else {
        // Create new task
        console.log('Attempting to create task with:', {
          organization_id: activeOrganizationId,
          name: taskName.trim(),
          description: taskDescription.trim() || null,
          is_active: taskIsActive,
          user: user,
        });
        
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            organization_id: activeOrganizationId,
            name: taskName.trim(),
            description: taskDescription.trim() || null,
            is_active: taskIsActive,
          })
          .select();
          
        console.log('Insert result:', { data, error });
        
        if (error) {
          console.error('Task creation error:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      resetTaskForm();
      toast.success(editingTask ? (t('taskUpdated') || 'Task updated') : (t('taskCreated') || 'Task created'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorSavingTask') || 'Failed to save task');
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['role-tasks', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['user-tasks', activeOrganizationId] });
      setTaskToDelete(null);
      toast.success(t('taskDeleted') || 'Task deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorDeletingTask') || 'Failed to delete task');
    }
  });

  // Assign task to role mutation
  const assignRoleTaskMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskForAssignment || !selectedRole) {
        throw new Error(t('selectTaskAndRole') || 'Please select a task and role');
      }

      const { error } = await supabase
        .from('role_tasks')
        .insert({
          organization_id: activeOrganizationId,
          task_id: selectedTaskForAssignment.id,
          role_name: selectedRole,
          is_active: true,
        });
      if (error) {
        // If already exists, just update to active
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('role_tasks')
            .update({ is_active: true })
            .eq('organization_id', activeOrganizationId)
            .eq('task_id', selectedTaskForAssignment.id)
            .eq('role_name', selectedRole);
          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-tasks', activeOrganizationId] });
      setSelectedTaskForAssignment(null);
      setSelectedRole('');
      toast.success(t('taskAssignedToRole') || 'Task assigned to role');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorAssigningTask') || 'Failed to assign task');
    }
  });

  // Assign task to user mutation
  const assignUserTaskMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskForAssignment || !selectedEmployee) {
        throw new Error(t('selectTaskAndEmployee') || 'Please select a task and employee');
      }

      const { error } = await supabase
        .from('user_tasks')
        .insert({
          organization_id: activeOrganizationId,
          task_id: selectedTaskForAssignment.id,
          employee_id: selectedEmployee,
          is_active: true,
        });
      if (error) {
        // If already exists, just update to active
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('user_tasks')
            .update({ is_active: true })
            .eq('organization_id', activeOrganizationId)
            .eq('task_id', selectedTaskForAssignment.id)
            .eq('employee_id', selectedEmployee);
          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tasks', activeOrganizationId] });
      setSelectedTaskForAssignment(null);
      setSelectedEmployee('');
      toast.success(t('taskAssignedToUser') || 'Task assigned to user');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorAssigningTask') || 'Failed to assign task');
    }
  });

  // Remove role assignment mutation
  const removeRoleTaskMutation = useMutation({
    mutationFn: async (roleTaskId: string) => {
      const { error } = await supabase
        .from('role_tasks')
        .update({ is_active: false })
        .eq('id', roleTaskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-tasks', activeOrganizationId] });
      toast.success(t('assignmentRemoved') || 'Assignment removed');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorRemovingAssignment') || 'Failed to remove assignment');
    }
  });

  // Remove user assignment mutation
  const removeUserTaskMutation = useMutation({
    mutationFn: async (userTaskId: string) => {
      const { error } = await supabase
        .from('user_tasks')
        .update({ is_active: false })
        .eq('id', userTaskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tasks', activeOrganizationId] });
      toast.success(t('assignmentRemoved') || 'Assignment removed');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorRemovingAssignment') || 'Failed to remove assignment');
    }
  });

  // Fetch rounds
  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ['rounds', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch round tasks
  const { data: roundTasks = [] } = useQuery<RoundTask[]>({
    queryKey: ['round-tasks', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_tasks')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch round assignments
  const { data: roundAssignments = [] } = useQuery<RoundAssignment[]>({
    queryKey: ['round-assignments', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_assignments')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch round schedules
  const { data: roundSchedules = [] } = useQuery<RoundSchedule[]>({
    queryKey: ['round-schedules', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_schedules')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch round date overrides
  const { data: roundDateOverrides = [] } = useQuery<RoundDateOverride[]>({
    queryKey: ['round-date-overrides', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_date_overrides')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    }
  });

  // Create/Update round mutation
  const roundMutation = useMutation({
    mutationFn: async () => {
      if (!roundName.trim()) {
        throw new Error(t('roundNameRequired') || 'Round name is required');
      }

      if (editingRound) {
        const { error } = await supabase
          .from('rounds')
          .update({
            name: roundName.trim(),
            description: roundDescription.trim() || null,
            is_active: roundIsActive,
          })
          .eq('id', editingRound.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rounds')
          .insert({
            organization_id: activeOrganizationId,
            name: roundName.trim(),
            description: roundDescription.trim() || null,
            is_active: roundIsActive,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', activeOrganizationId] });
      resetRoundForm();
      toast.success(editingRound ? (t('roundUpdated') || 'Round updated') : (t('roundCreated') || 'Round created'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorSavingRound') || 'Failed to save round');
    }
  });

  // Delete round mutation
  const deleteRoundMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase
        .from('rounds')
        .delete()
        .eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['round-tasks', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['round-assignments', activeOrganizationId] });
      setRoundToDelete(null);
      toast.success(t('roundDeleted') || 'Round deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorDeletingRound') || 'Failed to delete round');
    }
  });

  // Add tasks to round mutation
  const addTasksToRoundMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoundForTasks || selectedTasksForRound.length === 0) {
        throw new Error(t('selectTasks') || 'Please select tasks');
      }

      // Get current max display_order for this round
      const existingTasks = getRoundTasks(selectedRoundForTasks.id);
      const maxOrder = existingTasks.length > 0 
        ? Math.max(...existingTasks.map(rt => rt.display_order))
        : -1;

      const tasksToAdd = selectedTasksForRound.map((taskId, index) => ({
        organization_id: activeOrganizationId,
        round_id: selectedRoundForTasks.id,
        task_id: taskId,
        display_order: maxOrder + index + 1,
      }));

      const { error } = await supabase
        .from('round_tasks')
        .upsert(tasksToAdd, { onConflict: 'round_id,task_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-tasks', activeOrganizationId] });
      setSelectedTasksForRound([]);
      toast.success(t('taskAddedToRound') || 'Task added to round');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorAddingTaskToRound') || 'Failed to add task to round');
    }
  });

  // Remove task from round mutation
  const removeTaskFromRoundMutation = useMutation({
    mutationFn: async (roundTaskId: string) => {
      const { error } = await supabase
        .from('round_tasks')
        .delete()
        .eq('id', roundTaskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-tasks', activeOrganizationId] });
      toast.success(t('taskRemovedFromRound') || 'Task removed from round');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorRemovingTaskFromRound') || 'Failed to remove task from round');
    }
  });

  // Assign round mutation
  const assignRoundMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoundForAssignment || selectedDays.length === 0) {
        throw new Error(t('selectRoundAndAssignment') || 'Please select a round and assignment type');
      }

      if (roundAssignmentType === 'role' && !selectedRoundRole) {
        throw new Error(t('selectRole') || 'Please select a role');
      }
      if (roundAssignmentType === 'user' && selectedRoundEmployees.length === 0) {
        throw new Error(t('selectAtLeastOneEmployee') || 'Please select at least one employee');
      }

      if (roundAssignmentType === 'role') {
        // Single assignment for role
        const { data: assignment, error: assignmentError } = await supabase
          .from('round_assignments')
          .insert({
            organization_id: activeOrganizationId,
            round_id: selectedRoundForAssignment.id,
            assignment_type: 'role',
            role_name: selectedRoundRole,
            employee_id: null,
            is_active: true,
          })
          .select()
          .single();

        if (assignmentError) throw assignmentError;

        // Create schedules
        const schedules = selectedDays.map(day => ({
          organization_id: activeOrganizationId,
          round_assignment_id: assignment.id,
          day_of_week: day,
        }));

        const { error: scheduleError } = await supabase
          .from('round_schedules')
          .insert(schedules);

        if (scheduleError) throw scheduleError;
      } else {
        // Multiple assignments for users
        const assignments = selectedRoundEmployees.map(employeeId => ({
          organization_id: activeOrganizationId,
          round_id: selectedRoundForAssignment.id,
          assignment_type: 'user',
          role_name: null,
          employee_id: employeeId,
          is_active: true,
        }));

        const { data: createdAssignments, error: assignmentError } = await supabase
          .from('round_assignments')
          .insert(assignments)
          .select();

        if (assignmentError) throw assignmentError;

        // Create schedules for each assignment
        const allSchedules = createdAssignments.flatMap(assignment =>
          selectedDays.map(day => ({
            organization_id: activeOrganizationId,
            round_assignment_id: assignment.id,
            day_of_week: day,
          }))
        );

        const { error: scheduleError } = await supabase
          .from('round_schedules')
          .insert(allSchedules);

        if (scheduleError) throw scheduleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-assignments', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['round-schedules', activeOrganizationId] });
      setSelectedRoundForAssignment(null);
      setSelectedDays([]);
      setSelectedRoundRole('');
      setSelectedRoundEmployee('');
      setSelectedRoundEmployees([]);
      toast.success(t('roundAssigned') || 'Round assigned successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorAssigningRound') || 'Failed to assign round');
    }
  });

  // Add date override mutation
  const addDateOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssignmentForOverride || !overrideDate) {
        throw new Error(t('selectDate') || 'Please select a date');
      }

      const { error } = await supabase
        .from('round_date_overrides')
        .insert({
          organization_id: activeOrganizationId,
          round_assignment_id: selectedAssignmentForOverride.id,
          override_date: format(overrideDate, 'yyyy-MM-dd'),
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-date-overrides', activeOrganizationId] });
      setOverrideDate(undefined);
      setSelectedAssignmentForOverride(null);
      toast.success(t('dateOverrideAdded') || 'Date override added');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorAddingDateOverride') || 'Failed to add date override');
    }
  });

  // Remove date override mutation
  const removeDateOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const { error } = await supabase
        .from('round_date_overrides')
        .delete()
        .eq('id', overrideId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-date-overrides', activeOrganizationId] });
      toast.success(t('dateOverrideRemoved') || 'Date override removed');
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorRemovingDateOverride') || 'Failed to remove date override');
    }
  });

  // Helper functions
  const resetRoundForm = () => {
    setShowRoundForm(false);
    setEditingRound(null);
    setRoundName('');
    setRoundDescription('');
    setRoundIsActive(true);
  };

  const handleAddRound = () => {
    setEditingRound(null);
    setRoundName('');
    setRoundDescription('');
    setRoundIsActive(true);
    setShowRoundForm(true);
  };

  const handleEditRound = (round: Round) => {
    setEditingRound(round);
    setRoundName(round.name);
    setRoundDescription(round.description || '');
    setRoundIsActive(round.is_active);
    setShowRoundForm(true);
  };

  const getRoundTasks = (roundId: string) => {
    return roundTasks
      .filter(rt => rt.round_id === roundId)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const getRoundAssignments = (roundId: string) => {
    return roundAssignments.filter(ra => ra.round_id === roundId && ra.is_active);
  };

  const getAssignmentSchedules = (assignmentId: string) => {
    return roundSchedules.filter(rs => rs.round_assignment_id === assignmentId);
  };

  const getAssignmentOverrides = (assignmentId: string) => {
    return roundDateOverrides.filter(rdo => rdo.round_assignment_id === assignmentId);
  };

  const dayNames = [
    t('sunday') || 'Sunday',
    t('monday') || 'Monday',
    t('tuesday') || 'Tuesday',
    t('wednesday') || 'Wednesday',
    t('thursday') || 'Thursday',
    t('friday') || 'Friday',
    t('saturday') || 'Saturday',
  ];

  // Update task order mutation
  const updateTaskOrderMutation = useMutation({
    mutationFn: async ({ roundTaskId, newOrder }: { roundTaskId: string; newOrder: number }) => {
      const { error } = await supabase
        .from('round_tasks')
        .update({ display_order: newOrder })
        .eq('id', roundTaskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round-tasks', activeOrganizationId] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('errorUpdatingTaskOrder') || 'Failed to update task order');
    }
  });

  const handleMoveTask = async (roundTaskId: string, direction: 'up' | 'down', roundId: string) => {
    const tasksInRound = getRoundTasks(roundId);
    const currentIndex = tasksInRound.findIndex(rt => rt.id === roundTaskId);
    
    if (currentIndex === -1) return;
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === tasksInRound.length - 1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetTask = tasksInRound[newIndex];
    const currentTask = tasksInRound[currentIndex];
    
    // Swap orders
    await Promise.all([
      updateTaskOrderMutation.mutateAsync({ roundTaskId: currentTask.id, newOrder: targetTask.display_order }),
      updateTaskOrderMutation.mutateAsync({ roundTaskId: targetTask.id, newOrder: currentTask.display_order }),
    ]);
  };

  // Filtered and sorted rounds
  const filteredRounds = useMemo(() => {
    let filtered = rounds.filter(round => {
      const matchesSearch = !roundSearchTerm || 
        round.name.toLowerCase().includes(roundSearchTerm.toLowerCase()) ||
        (round.description && round.description.toLowerCase().includes(roundSearchTerm.toLowerCase()));
      
      const matchesStatus = roundStatusFilter === 'all' || 
        (roundStatusFilter === 'active' && round.is_active) ||
        (roundStatusFilter === 'inactive' && !round.is_active);
      
      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      if (roundSortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (roundSortBy === 'tasks') {
        const aTasks = getRoundTasks(a.id).length;
        const bTasks = getRoundTasks(b.id).length;
        return bTasks - aTasks;
      } else { // created
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [rounds, roundSearchTerm, roundStatusFilter, roundSortBy, roundTasks]);

  // Round statistics
  const roundStatistics = useMemo(() => {
    const stats = rounds.map(round => {
      const tasksInRound = getRoundTasks(round.id);
      const assignments = getRoundAssignments(round.id);
      const totalAssignments = assignments.length;
      
      // Count employees assigned
      const employeeAssignments = assignments.filter(a => a.assignment_type === 'user');
      const roleAssignments = assignments.filter(a => a.assignment_type === 'role');
      
      // Get employees from role assignments
      const roleNames = roleAssignments.map(a => a.role_name).filter(Boolean) as string[];
      const employeesInRoles = employees.filter(e => roleNames.includes(e.role)).length;
      
      const totalEmployees = employeeAssignments.length + employeesInRoles;
      
      return {
        round_id: round.id,
        round_name: round.name,
        task_count: tasksInRound.length,
        total_assignments: totalAssignments,
        total_employees: totalEmployees,
        is_active: round.is_active,
      };
    });

    return {
      total_rounds: stats.length,
      active_rounds: stats.filter(s => s.is_active).length,
      total_tasks_in_rounds: stats.reduce((sum, s) => sum + s.task_count, 0),
      total_assignments: stats.reduce((sum, s) => sum + s.total_assignments, 0),
      total_employees_assigned: stats.reduce((sum, s) => sum + s.total_employees, 0),
      round_details: stats,
    };
  }, [rounds, roundTasks, roundAssignments, employees]);

  // Calculate summary statistics for performance
  const summaryStats = useMemo(() => {
    if (performanceData.length === 0) {
      return {
        totalEmployees: 0,
        totalTasksAssigned: 0,
        totalTasksCompleted: 0,
        averageCompletionRate: 0,
        totalShiftsWithTasks: 0,
        totalShiftsCompletedAllTasks: 0,
      };
    }

    const totalTasksAssigned = performanceData.reduce((sum, emp) => sum + (emp.total_tasks_assigned || 0), 0);
    const totalTasksCompleted = performanceData.reduce((sum, emp) => sum + (emp.total_tasks_completed || 0), 0);
    const averageCompletionRate = performanceData.reduce((sum, emp) => sum + (emp.completion_rate || 0), 0) / performanceData.length;
    const totalShiftsWithTasks = performanceData.reduce((sum, emp) => sum + (emp.shifts_with_tasks || 0), 0);
    const totalShiftsCompletedAllTasks = performanceData.reduce((sum, emp) => sum + (emp.shifts_completed_all_tasks || 0), 0);

    return {
      totalEmployees: performanceData.length,
      totalTasksAssigned,
      totalTasksCompleted,
      averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
      totalShiftsWithTasks,
      totalShiftsCompletedAllTasks,
    };
  }, [performanceData]);

  // Export to Excel
  const exportToExcel = () => {
    try {
      const data = performanceData.map((emp, index) => ({
        '#': index + 1,
        'Employee Name': emp.employee_name,
        'Staff ID': emp.employee_staff_id,
        'Role': emp.employee_role,
        'Total Tasks Assigned': emp.total_tasks_assigned,
        'Total Tasks Completed': emp.total_tasks_completed,
        'Completion Rate (%)': emp.completion_rate.toFixed(2),
        'Shifts with Tasks': emp.shifts_with_tasks,
        'Shifts Completed All Tasks': emp.shifts_completed_all_tasks,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Task Performance');

      const filename = `task-performance-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(t('reportExported') || 'Report exported successfully');
    } catch (error: any) {
      console.error('Error exporting report:', error);
      toast.error(error.message || t('errorExportingReport') || 'Failed to export report');
    }
  };

  const resetTaskForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setTaskName('');
    setTaskDescription('');
    setTaskIsActive(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskDescription('');
    setTaskIsActive(true);
    setShowTaskForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || '');
    setTaskIsActive(task.is_active);
    setShowTaskForm(true);
  };

  const getTaskAssignments = (taskId: string) => {
    const roleAssignments = roleTasks
      .filter(rt => rt.task_id === taskId && rt.is_active)
      .map(rt => rt.role_name);
    const userAssignments = userTasks
      .filter(ut => ut.task_id === taskId && ut.is_active)
      .map(ut => {
        const employee = employees.find(e => e.id === ut.employee_id);
        return employee ? employee.full_name : 'Unknown';
      });
    return { roleAssignments, userAssignments };
  };

  if (!activeOrganizationId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">{t('selectOrganization') || 'Please select an organization'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('taskManagement') || 'Task Management'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('taskManagementDescription') || 'Create and manage shift tasks, assign them to roles or users'}
          </p>
        </div>
        <Button onClick={handleAddTask} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addTask') || 'Add Task'}
        </Button>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            <ClipboardList className="h-4 w-4 me-2" />
            {t('tasks') || 'Tasks'}
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Users className="h-4 w-4 me-2" />
            {t('assignments') || 'Assignments'}
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="h-4 w-4 me-2" />
            {t('taskPerformance') || 'Performance'}
          </TabsTrigger>
          <TabsTrigger value="rounds">
            <Clock className="h-4 w-4 me-2" />
            {t('rounds') || 'Rounds'}
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('taskLibrary') || 'Task Library'}</CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
              ) : tasks.length === 0 ? (
                <p className="text-muted-foreground">{t('noTasksFound') || 'No tasks found. Create your first task!'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('name') || 'Name'}</TableHead>
                      <TableHead>{t('description') || 'Description'}</TableHead>
                      <TableHead>{t('assignments') || 'Assignments'}</TableHead>
                      <TableHead>{t('status') || 'Status'}</TableHead>
                      <TableHead>{t('actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const { roleAssignments, userAssignments } = getTaskAssignments(task.id);
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {task.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {roleAssignments.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs">
                                  <Users className="h-3 w-3 me-1" />
                                  {role}
                                </Badge>
                              ))}
                              {userAssignments.map((name) => (
                                <Badge key={name} variant="outline" className="text-xs">
                                  <User className="h-3 w-3 me-1" />
                                  {name}
                                </Badge>
                              ))}
                              {roleAssignments.length === 0 && userAssignments.length === 0 && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={task.is_active ? 'default' : 'secondary'}>
                              {task.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTask(task)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTaskToDelete(task)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('assignTasks') || 'Assign Tasks'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('selectTask') || 'Select Task'}</Label>
                <Select
                  value={selectedTaskForAssignment?.id || ''}
                  onValueChange={(value) => {
                    const task = tasks.find(t => t.id === value);
                    setSelectedTaskForAssignment(task || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTask') || 'Select a task'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.filter(t => t.is_active).map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('assignmentType') || 'Assignment Type'}</Label>
                <Select value={assignmentType} onValueChange={(value: 'role' | 'user') => setAssignmentType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">{t('assignToRole') || 'Assign to Role'}</SelectItem>
                    <SelectItem value="user">{t('assignToUser') || 'Assign to User'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {assignmentType === 'role' && (
                <div className="space-y-2">
                  <Label>{t('selectRole') || 'Select Role'}</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRole') || 'Select a role'} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => assignRoleTaskMutation.mutate()}
                    disabled={!selectedTaskForAssignment || !selectedRole}
                    className="w-full"
                  >
                    <Users className="h-4 w-4 me-2" />
                    {t('assignToRole') || 'Assign to Role'}
                  </Button>
                </div>
              )}

              {assignmentType === 'user' && (
                <div className="space-y-2">
                  <Label>{t('selectEmployee') || 'Select Employee'}</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectEmployee') || 'Select an employee'} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name} ({employee.staff_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => assignUserTaskMutation.mutate()}
                    disabled={!selectedTaskForAssignment || !selectedEmployee}
                    className="w-full"
                  >
                    <User className="h-4 w-4 me-2" />
                    {t('assignToUser') || 'Assign to User'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('roleAssignments') || 'Role Assignments'}</CardTitle>
            </CardHeader>
            <CardContent>
              {roleTasks.filter(rt => rt.is_active).length === 0 ? (
                <p className="text-muted-foreground">{t('noRoleAssignments') || 'No role assignments'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('task') || 'Task'}</TableHead>
                      <TableHead>{t('role') || 'Role'}</TableHead>
                      <TableHead>{t('actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleTasks
                      .filter(rt => rt.is_active)
                      .map((rt) => {
                        const task = tasks.find(t => t.id === rt.task_id);
                        return (
                          <TableRow key={rt.id}>
                            <TableCell>{task?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{rt.role_name}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRoleTaskMutation.mutate(rt.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* User Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('userAssignments') || 'User Assignments'}</CardTitle>
            </CardHeader>
            <CardContent>
              {userTasks.filter(ut => ut.is_active).length === 0 ? (
                <p className="text-muted-foreground">{t('noUserAssignments') || 'No user assignments'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('task') || 'Task'}</TableHead>
                      <TableHead>{t('employee') || 'Employee'}</TableHead>
                      <TableHead>{t('actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userTasks
                      .filter(ut => ut.is_active)
                      .map((ut) => {
                        const task = tasks.find(t => t.id === ut.task_id);
                        const employee = employees.find(e => e.id === ut.employee_id);
                        return (
                          <TableRow key={ut.id}>
                            <TableCell>{task?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              {employee ? `${employee.full_name} (${employee.staff_id})` : 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUserTaskMutation.mutate(ut.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={exportToExcel} disabled={performanceData.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              {t('export') || 'Export'}
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>{t('filters') || 'Filters'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dateRange') || 'Date Range'}</Label>
                  <TimesheetDateFilter
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('filterByEmployee') || 'Filter by Employee'}</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('allEmployees') || 'All Employees'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allEmployees') || 'All Employees'}</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.staff_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalEmployees') || 'Total Employees'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryStats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('employeesWithTasks') || 'Employees with tasks'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalTasksAssigned') || 'Total Tasks Assigned'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryStats.totalTasksAssigned}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acrossAllShifts') || 'Across all shifts'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalTasksCompleted') || 'Total Tasks Completed'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summaryStats.totalTasksCompleted}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.totalTasksAssigned > 0
                    ? `${Math.round((summaryStats.totalTasksCompleted / summaryStats.totalTasksAssigned) * 100)}% ${t('completionRate') || 'completion rate'}`
                    : '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('averageCompletionRate') || 'Average Completion Rate'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryStats.averageCompletionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acrossAllEmployees') || 'Across all employees'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('performanceDetails') || 'Performance Details'}</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
              ) : performanceData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t('noDataFound') || 'No data found'}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('noTaskPerformanceData') || 'No task performance data available for the selected period.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('employee') || 'Employee'}</TableHead>
                        <TableHead>{t('role') || 'Role'}</TableHead>
                        <TableHead className="text-center">{t('tasksAssigned') || 'Tasks Assigned'}</TableHead>
                        <TableHead className="text-center">{t('tasksCompleted') || 'Tasks Completed'}</TableHead>
                        <TableHead className="text-center">{t('completionRate') || 'Completion Rate'}</TableHead>
                        <TableHead className="text-center">{t('shiftsWithTasks') || 'Shifts with Tasks'}</TableHead>
                        <TableHead className="text-center">{t('perfectShifts') || 'Perfect Shifts'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceData.map((emp) => (
                        <TableRow key={emp.employee_id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{emp.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{emp.employee_staff_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{emp.employee_role}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{emp.total_tasks_assigned}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              {emp.total_tasks_completed}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{emp.completion_rate.toFixed(1)}%</span>
                              </div>
                              <Progress value={emp.completion_rate} className="h-2" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{emp.shifts_with_tasks}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={emp.shifts_completed_all_tasks > 0 ? 'default' : 'secondary'}>
                              {emp.shifts_completed_all_tasks}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rounds Tab */}
        <TabsContent value="rounds" className="space-y-4">
          {/* Round Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalRounds') || 'Total Rounds'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roundStatistics.total_rounds}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {roundStatistics.active_rounds} {t('active') || 'active'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalTasksInRounds') || 'Tasks in Rounds'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roundStatistics.total_tasks_in_rounds}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acrossAllRounds') || 'across all rounds'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalAssignments') || 'Total Assignments'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roundStatistics.total_assignments}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('roundAssignments') || 'round assignments'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('employeesAssigned') || 'Employees Assigned'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roundStatistics.total_employees_assigned}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acrossAllRounds') || 'across all rounds'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('averageTasksPerRound') || 'Avg Tasks/Round'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {roundStatistics.total_rounds > 0 
                    ? (roundStatistics.total_tasks_in_rounds / roundStatistics.total_rounds).toFixed(1)
                    : '0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('tasksPerRound') || 'tasks per round'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('filters') || 'Filters'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('search') || 'Search'}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('searchRounds') || 'Search rounds...'}
                      value={roundSearchTerm}
                      onChange={(e) => setRoundSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('status') || 'Status'}</Label>
                  <Select value={roundStatusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setRoundStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                      <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                      <SelectItem value="inactive">{t('inactive') || 'Inactive'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('sortBy') || 'Sort By'}</Label>
                  <Select value={roundSortBy} onValueChange={(value: 'name' | 'created' | 'tasks') => setRoundSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">{t('dateCreated') || 'Date Created'}</SelectItem>
                      <SelectItem value="name">{t('name') || 'Name'}</SelectItem>
                      <SelectItem value="tasks">{t('taskCount') || 'Task Count'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('rounds') || 'Rounds'}</CardTitle>
                <Button onClick={handleAddRound} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('addRound') || 'Add Round'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {roundsLoading ? (
                <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
              ) : filteredRounds.length === 0 ? (
                <p className="text-muted-foreground">
                  {roundSearchTerm || roundStatusFilter !== 'all' 
                    ? t('noRoundsMatchFilters') || 'No rounds match the filters'
                    : t('noRoundsFound') || 'No rounds found. Create your first round!'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('name') || 'Name'}</TableHead>
                      <TableHead>{t('description') || 'Description'}</TableHead>
                      <TableHead>{t('roundTasks') || 'Tasks'}</TableHead>
                      <TableHead>{t('assignments') || 'Assignments'}</TableHead>
                      <TableHead>{t('status') || 'Status'}</TableHead>
                      <TableHead>{t('actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRounds.map((round) => {
                      const roundTasksList = getRoundTasks(round.id);
                      const assignments = getRoundAssignments(round.id);
                      return (
                        <TableRow key={round.id}>
                          <TableCell className="font-medium">{round.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {round.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{roundTasksList.length} {t('tasks') || 'tasks'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{assignments.length} {t('assignments') || 'assignments'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={round.is_active ? 'default' : 'secondary'}>
                              {round.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRoundForTasks(round);
                                  setSelectedTasksForRound([]);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRound(round)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRoundToDelete(round)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add Tasks to Round */}
          {selectedRoundForTasks && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('addTasksToRound') || 'Add Tasks to Round'}: {selectedRoundForTasks.name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRoundForTasks(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('selectTasks') || 'Select Tasks'}</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-4">
                    {tasks.filter(t => t.is_active).map((task) => {
                      const isInRound = roundTasks.some(rt => rt.round_id === selectedRoundForTasks.id && rt.task_id === task.id);
                      return (
                        <div key={task.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={selectedTasksForRound.includes(task.id) || isInRound}
                            disabled={isInRound}
                            onCheckedChange={(checked) => {
                              if (checked && !isInRound) {
                                setSelectedTasksForRound([...selectedTasksForRound, task.id]);
                              } else if (!checked) {
                                setSelectedTasksForRound(selectedTasksForRound.filter(id => id !== task.id));
                              }
                            }}
                          />
                          <Label htmlFor={`task-${task.id}`} className="flex-1 cursor-pointer">
                            {task.name}
                            {isInRound && <Badge variant="secondary" className="ms-2 text-xs">{t('alreadyAdded') || 'Added'}</Badge>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Button
                  onClick={() => addTasksToRoundMutation.mutate()}
                  disabled={selectedTasksForRound.length === 0 || addTasksToRoundMutation.isPending}
                  className="w-full"
                >
                  {addTasksToRoundMutation.isPending ? (t('saving') || 'Saving...') : (t('addTasksToRound') || 'Add Tasks to Round')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Round Tasks List */}
          {selectedRoundForTasks && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tasksInRound') || 'Tasks in Round'}: {selectedRoundForTasks.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {getRoundTasks(selectedRoundForTasks.id).length === 0 ? (
                  <p className="text-muted-foreground">{t('noTasksInRound') || 'No tasks in this round'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">{t('order') || 'Order'}</TableHead>
                        <TableHead>{t('task') || 'Task'}</TableHead>
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getRoundTasks(selectedRoundForTasks.id).map((rt, index) => {
                        const task = tasks.find(t => t.id === rt.task_id);
                        const tasksInRound = getRoundTasks(selectedRoundForTasks.id);
                        return (
                          <TableRow key={rt.id}>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={index === 0}
                                  onClick={() => handleMoveTask(rt.id, 'up', selectedRoundForTasks.id)}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={index === tasksInRound.length - 1}
                                  onClick={() => handleMoveTask(rt.id, 'down', selectedRoundForTasks.id)}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                <span>{task?.name || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTaskFromRoundMutation.mutate(rt.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assign Round */}
          <Card>
            <CardHeader>
              <CardTitle>{t('assignRound') || 'Assign Round'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('selectRound') || 'Select Round'}</Label>
                <Select
                  value={selectedRoundForAssignment?.id || ''}
                  onValueChange={(value) => {
                    const round = rounds.find(r => r.id === value);
                    setSelectedRoundForAssignment(round || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectRound') || 'Select a round'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.filter(r => r.is_active).map((round) => (
                      <SelectItem key={round.id} value={round.id}>
                        {round.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('assignmentType') || 'Assignment Type'}</Label>
                <Select value={roundAssignmentType} onValueChange={(value: 'role' | 'user') => setRoundAssignmentType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">{t('assignRoundToRole') || 'Assign to Role'}</SelectItem>
                    <SelectItem value="user">{t('assignRoundToUser') || 'Assign to User'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {roundAssignmentType === 'role' && (
                <div className="space-y-2">
                  <Label>{t('selectRole') || 'Select Role'}</Label>
                  <Select value={selectedRoundRole} onValueChange={setSelectedRoundRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRole') || 'Select a role'} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {roundAssignmentType === 'user' && (
                <div className="space-y-2">
                  <Label>{t('selectEmployees') || 'Select Employees'}</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-4">
                    {employees.map((employee) => {
                      const isSelected = selectedRoundEmployees.includes(employee.id);
                      return (
                        <div key={employee.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`employee-${employee.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRoundEmployees([...selectedRoundEmployees, employee.id]);
                              } else {
                                setSelectedRoundEmployees(selectedRoundEmployees.filter(id => id !== employee.id));
                              }
                            }}
                          />
                          <Label htmlFor={`employee-${employee.id}`} className="flex-1 cursor-pointer">
                            {employee.full_name} ({employee.staff_id})
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  {selectedRoundEmployees.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedRoundEmployees.length} {selectedRoundEmployees.length === 1 ? t('employeeSelected') || 'employee selected' : t('employeesSelected') || 'employees selected'}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('daySchedule') || 'Day Schedule'}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {dayNames.map((dayName, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${index}`}
                        checked={selectedDays.includes(index)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDays([...selectedDays, index]);
                          } else {
                            setSelectedDays(selectedDays.filter(d => d !== index));
                          }
                        }}
                      />
                      <Label htmlFor={`day-${index}`} className="cursor-pointer text-sm">
                        {dayName}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => assignRoundMutation.mutate()}
                disabled={!selectedRoundForAssignment || selectedDays.length === 0 || 
                  (roundAssignmentType === 'role' && !selectedRoundRole) ||
                  (roundAssignmentType === 'user' && selectedRoundEmployees.length === 0)}
                className="w-full"
              >
                {t('assignRound') || 'Assign Round'}
              </Button>
            </CardContent>
          </Card>

          {/* Round Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('roundAssignments') || 'Round Assignments'}</CardTitle>
            </CardHeader>
            <CardContent>
              {roundAssignments.filter(ra => ra.is_active).length === 0 ? (
                <p className="text-muted-foreground">{t('noRoundAssignments') || 'No round assignments'}</p>
              ) : (
                <div className="space-y-4">
                  {rounds.map((round) => {
                    const assignments = getRoundAssignments(round.id);
                    if (assignments.length === 0) return null;
                    return (
                      <div key={round.id} className="border rounded-lg p-4 space-y-2">
                        <h4 className="font-medium">{round.name}</h4>
                        {assignments.map((assignment) => {
                          const schedules = getAssignmentSchedules(assignment.id);
                          const overrides = getAssignmentOverrides(assignment.id);
                          const assignmentName = assignment.assignment_type === 'role'
                            ? assignment.role_name
                            : employees.find(e => e.id === assignment.employee_id)?.full_name || 'Unknown';
                          return (
                            <div key={assignment.id} className="bg-muted/50 rounded p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Badge variant={assignment.assignment_type === 'role' ? 'secondary' : 'outline'}>
                                    {assignment.assignment_type === 'role' ? t('role') || 'Role' : t('user') || 'User'}
                                  </Badge>
                                  <span className="ms-2 font-medium">{assignmentName}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedAssignmentForOverride(assignment)}
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {schedules.length > 0 ? (
                                  <div>
                                    <span className="font-medium">{t('daySchedule') || 'Days'}: </span>
                                    {schedules.map(s => dayNames[s.day_of_week]).join(', ')}
                                  </div>
                                ) : (
                                  <span>{t('noDaySchedule') || 'No day schedule set'}</span>
                                )}
                              </div>
                              {overrides.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">{t('dateOverrides') || 'Date Overrides'}: </span>
                                  {overrides.map(o => format(new Date(o.override_date), 'MMM dd, yyyy')).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date Override Dialog */}
          {selectedAssignmentForOverride && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('addDateOverride') || 'Add Date Override'}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedAssignmentForOverride(null);
                    setOverrideDate(undefined);
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('selectDate') || 'Select Date'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {overrideDate ? format(overrideDate, 'PPP') : <span>{t('selectDate') || 'Pick a date'}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={overrideDate}
                        onSelect={setOverrideDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  onClick={() => addDateOverrideMutation.mutate()}
                  disabled={!overrideDate || addDateOverrideMutation.isPending}
                  className="w-full"
                >
                  {addDateOverrideMutation.isPending ? (t('saving') || 'Saving...') : (t('addDateOverride') || 'Add Date Override')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Round Form Dialog */}
      {showRoundForm && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <CardContent className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>{editingRound ? (t('editRound') || 'Edit Round') : (t('addRound') || 'Add Round')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetRoundForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="round-name">{t('roundName') || 'Round Name'} *</Label>
                <Input
                  id="round-name"
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder={t('enterRoundName') || 'Enter round name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round-description">{t('roundDescription') || 'Round Description'}</Label>
                <Textarea
                  id="round-description"
                  value={roundDescription}
                  onChange={(e) => setRoundDescription(e.target.value)}
                  placeholder={t('enterRoundDescription') || 'Enter round description (optional)'}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="round-active">{t('active') || 'Active'}</Label>
                <Switch
                  id="round-active"
                  checked={roundIsActive}
                  onCheckedChange={setRoundIsActive}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => roundMutation.mutate()}
                  disabled={roundMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 me-2" />
                  {roundMutation.isPending ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
                <Button variant="outline" onClick={resetRoundForm} className="flex-1">
                  {t('cancel') || 'Cancel'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Round Confirmation Dialog */}
      <AlertDialog open={!!roundToDelete} onOpenChange={(open) => !open && setRoundToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRound') || 'Delete Round'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteRoundConfirmation') || 'Are you sure you want to delete this round? This will also remove all assignments and schedules.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roundToDelete && deleteRoundMutation.mutate(roundToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Form Dialog */}
      {showTaskForm && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <CardContent className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>{editingTask ? (t('editTask') || 'Edit Task') : (t('addTask') || 'Add Task')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetTaskForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-name">{t('name') || 'Name'} *</Label>
                <Input
                  id="task-name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={t('enterTaskName') || 'Enter task name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description">{t('description') || 'Description'}</Label>
                <Textarea
                  id="task-description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder={t('enterTaskDescription') || 'Enter task description (optional)'}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="task-active">{t('active') || 'Active'}</Label>
                <Switch
                  id="task-active"
                  checked={taskIsActive}
                  onCheckedChange={setTaskIsActive}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => taskMutation.mutate()}
                  disabled={taskMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 me-2" />
                  {taskMutation.isPending ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
                <Button variant="outline" onClick={resetTaskForm} className="flex-1">
                  {t('cancel') || 'Cancel'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTask') || 'Delete Task'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTaskConfirmation') || 'Are you sure you want to delete this task? This will also remove all assignments.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskManagementPage;
