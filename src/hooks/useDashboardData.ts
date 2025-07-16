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

      // Call the new, optimized database function
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        from_date: fromDate,
        to_date: toDate,
      });

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw new Error('Failed to fetch dashboard statistics.');
      }

      return data as unknown as DashboardData;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
