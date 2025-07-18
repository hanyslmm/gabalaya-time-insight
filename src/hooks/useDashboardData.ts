import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

interface DashboardData {
  employeeCount: number;
  totalHours: number;
  totalPayroll: number;
  totalShifts: number;
}

export const useDashboardData = (dateRange: DateRange, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dashboard-data', dateRange],
    queryFn: async (): Promise<DashboardData> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get employee count for employees who worked in the period
      const { data: employeeData, error: employeeError } = await supabase
        .from('timesheet_entries')
        .select('employee_id')
        .gte('clock_in_date', fromDate)
        .lte('clock_in_date', toDate);

      if (employeeError) {
        console.error('Error fetching employee data:', employeeError);
        throw new Error('Failed to fetch employee data.');
      }

      const uniqueEmployees = new Set(employeeData?.map(entry => entry.employee_id) || []);
      const employeeCount = uniqueEmployees.size;

      // Call the dashboard stats function for other metrics
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        from_date: fromDate,
        to_date: toDate,
      });

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw new Error('Failed to fetch dashboard statistics.');
      }

      const stats = data as any;
      return {
        employeeCount,
        totalHours: stats?.totalHours || 0,
        totalPayroll: stats?.totalPayroll || 0,
        totalShifts: stats?.totalShifts || 0
      } as DashboardData;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
