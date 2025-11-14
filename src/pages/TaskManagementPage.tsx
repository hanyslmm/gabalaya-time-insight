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
import { Plus, Edit, Trash2, Users, User, ClipboardList, Save, X, TrendingUp, Download, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
      </Tabs>

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
