import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  return useQuery({
    queryKey: ['dashboard-data', format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'), activeOrganizationId],
    queryFn: async (): Promise<DashboardData> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Call the dashboard stats function
      const { data, error } = await (supabase as any).rpc('get_dashboard_stats', {
        from_date: fromDate,
        to_date: toDate
      });

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw new Error('Failed to fetch dashboard statistics.');
      }

      const stats = data as any;
      return {
        employeeCount: stats?.employeeCount || 0,
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
