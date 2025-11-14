import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Task {
  task_id: string;
  task_name: string;
  task_description: string | null;
  assignment_type: 'role' | 'user';
  is_completed: boolean;
  completed_at: string | null;
}

interface ShiftTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheetEntryId: string;
  tasks: Task[];
  organizationId: string;
}

const ShiftTasksModal: React.FC<ShiftTasksModalProps> = ({
  isOpen,
  onClose,
  timesheetEntryId,
  tasks,
  organizationId
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>({});
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});

  // Initialize task states from props
  React.useEffect(() => {
    const initialState: Record<string, boolean> = {};
    tasks.forEach(task => {
      initialState[task.task_id] = task.is_completed;
    });
    setTaskStates(initialState);
  }, [tasks]);

  const handleTaskToggle = async (taskId: string, currentState: boolean) => {
    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));

    try {
      let result;
      if (currentState) {
        // Uncomplete task
        const { data, error } = await supabase.rpc('uncomplete_shift_task', {
          p_timesheet_entry_id: timesheetEntryId,
          p_task_id: taskId,
          p_organization_id: organizationId
        });

        if (error) throw error;
        result = data;
      } else {
        // Complete task
        const { data, error } = await supabase.rpc('complete_shift_task', {
          p_timesheet_entry_id: timesheetEntryId,
          p_task_id: taskId,
          p_organization_id: organizationId
        });

        if (error) throw error;
        result = data;
      }

      if (result?.success) {
        // Update local state
        setTaskStates(prev => ({ ...prev, [taskId]: !currentState }));
        toast.success(
          currentState 
            ? t('taskUncompleted') || 'Task unchecked'
            : t('taskCompleted') || 'Task completed!'
        );
      } else {
        throw new Error(result?.error || 'Failed to update task');
      }
    } catch (error: any) {
      console.error('Error toggling task:', error);
      toast.error(error.message || t('errorUpdatingTask') || 'Failed to update task');
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const completedCount = Object.values(taskStates).filter(Boolean).length;
  const totalCount = tasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {t('shiftTasks') || 'Shift Tasks'}
          </DialogTitle>
          <DialogDescription>
            {t('shiftTasksDescription') || 'Complete your assigned tasks for this shift'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Summary */}
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('progress') || 'Progress'}
              </span>
              <span className="text-sm font-bold text-primary">
                {completedCount} / {totalCount}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {completionPercentage}% {t('complete') || 'complete'}
            </p>
          </div>

          {/* Tasks List */}
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('noTasksAssigned') || 'No tasks assigned for this shift'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isCompleted = taskStates[task.task_id] || false;
                const isLoading = loadingTasks[task.task_id] || false;

                return (
                  <div
                    key={task.task_id}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                      isCompleted
                        ? 'bg-success/5 border-success/20'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center pt-0.5">
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => handleTaskToggle(task.task_id, isCompleted)}
                          className="h-5 w-5"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              isCompleted
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                            }`}
                          >
                            {task.task_name}
                          </p>
                          {task.task_description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.task_description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={task.assignment_type === 'role' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {task.assignment_type === 'role'
                            ? t('role') || 'Role'
                            : t('user') || 'User'}
                        </Badge>
                      </div>
                      {isCompleted && task.completed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t('completedAt') || 'Completed at'}:{' '}
                          {new Date(task.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('close') || 'Close'}
            </Button>
            {completionPercentage === 100 && (
              <Button onClick={onClose} className="bg-success hover:bg-success/90">
                {t('allTasksComplete') || 'All Tasks Complete!'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftTasksModal;


