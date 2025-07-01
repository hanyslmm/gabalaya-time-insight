
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createOrFindEmployee } from '@/services/employeeService';
import { toast } from 'sonner';

export const useTimesheetUpload = (onUploadComplete: () => void, onClose: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timesheetData: any[]) => {
      console.log('Processing timesheet data with employee creation...');
      
      // Process each entry to ensure employee exists
      const processedEntries = [];
      const employeeStats = { created: 0, found: 0 };

      for (const entry of timesheetData) {
        try {
          const employeeId = await createOrFindEmployee(
            entry.employee_name, 
            entry.payroll_id
          );
          
          if (employeeId) {
            // Check if this created a new employee
            const { data: employee } = await supabase
              .from('employees')
              .select('created_at')
              .eq('id', employeeId)
              .single();
              
            if (employee) {
              const createdToday = new Date(employee.created_at).toDateString() === new Date().toDateString();
              if (createdToday) {
                employeeStats.created++;
              } else {
                employeeStats.found++;
              }
            }
          }

          processedEntries.push({
            ...entry,
            employee_id: employeeId
          });
        } catch (error) {
          console.error('Error processing employee:', entry.employee_name, error);
          // Continue with other entries even if one fails
          processedEntries.push(entry);
        }
      }

      console.log('Employee processing stats:', employeeStats);

      // Insert timesheet entries
      const { data, error } = await supabase
        .from('timesheet_entries')
        .insert(processedEntries);
      
      if (error) throw error;
      
      return { data, stats: employeeStats };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      const { stats } = result;
      let message = 'Timesheet uploaded successfully';
      
      if (stats.created > 0 || stats.found > 0) {
        message += ` | ${stats.created} new employees created, ${stats.found} existing employees found`;
      }
      
      toast.success(message);
      onUploadComplete();
      onClose();
    },
    onError: (error) => {
      console.error('Error uploading timesheet:', error);
      toast.error('Error uploading timesheet');
    }
  });
};
