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

      // Try the dashboard stats function first, fallback to direct query if it fails
      let stats: any = null;
      
      try {
        const { data, error } = await (supabase as any).rpc('get_dashboard_stats', {
          from_date: fromDate,
          to_date: toDate
        });

        if (!error && data) {
          stats = data;
        }
      } catch (rpcError) {
        console.warn('RPC function failed, falling back to direct query:', rpcError);
      }

      // Fallback: Direct query if RPC function fails or returns no data
      if (!stats) {
        // Load employees to correlate legacy rows (organization_id is null)
        const { data: employees } = await supabase
          .from('employees')
          .select('id, staff_id, full_name')
          .eq('organization_id', activeOrganizationId);

        const employeeRows = employees || [];
        const employeeIds = employeeRows.map((e: any) => e.id);
        const employeeStaffIds = employeeRows.map((e: any) => e.staff_id).filter(Boolean);
        const employeeNames = employeeRows.map((e: any) => e.full_name).filter(Boolean);

        const applyDateFilter = (q: any) =>
          q.gte('clock_in_date', fromDate).lte('clock_in_date', toDate);

        // Query A: current org
        let queryOrg = supabase
          .from('timesheet_entries')
          .select(`
            *,
            employees!inner(morning_wage_rate, night_wage_rate)
          `);
        if (activeOrganizationId) queryOrg = queryOrg.eq('organization_id', activeOrganizationId);
        queryOrg = applyDateFilter(queryOrg);

        // Query B: legacy rows with null organization
        let queryLegacy = supabase
          .from('timesheet_entries')
          .select(`
            *,
            employees!inner(morning_wage_rate, night_wage_rate)
          `)
          .is('organization_id', null);
        queryLegacy = applyDateFilter(queryLegacy);
        if (employeeIds.length > 0) {
          queryLegacy = queryLegacy.in('employee_id', employeeIds);
        } else if (employeeStaffIds.length > 0 || employeeNames.length > 0) {
          const orParts: string[] = [];
          if (employeeStaffIds.length > 0) {
            const staffVals = employeeStaffIds.map((v: string) => `"${v}"`).join(',');
            orParts.push(`employee_name.in.(${staffVals})`);
          }
          if (employeeNames.length > 0) {
            const nameVals = employeeNames.map((v: string) => `"${v}"`).join(',');
            orParts.push(`employee_name.in.(${nameVals})`);
          }
          if (orParts.length > 0) {
            queryLegacy = queryLegacy.or(orParts.join(','));
          }
        }

        const [resOrg, resLegacy] = await Promise.all([queryOrg, queryLegacy]);
        if (resOrg.error) throw resOrg.error;
        if (resLegacy.error) throw resLegacy.error;
        const entries = [ ...(resOrg.data || []), ...(resLegacy.data || []) ];

        // Calculate stats manually
        const uniqueEmployees = new Set();
        let totalHours = 0;
        let totalPayroll = 0;
        let totalShifts = entries?.length || 0;

        entries?.forEach(entry => {
          if (entry.employee_name) uniqueEmployees.add(entry.employee_name);
          totalHours += entry.total_hours || 0;
          
          // Calculate payroll
          if (entry.total_card_amount_split) {
            totalPayroll += entry.total_card_amount_split;
          } else if (entry.total_card_amount_flat) {
            totalPayroll += entry.total_card_amount_flat;
          } else if (entry.total_hours && entry.employees) {
            // Fallback calculation
            const morningRate = entry.employees.morning_wage_rate || 20;
            const nightRate = entry.employees.night_wage_rate || 20;
            const avgRate = (morningRate + nightRate) / 2;
            totalPayroll += (entry.total_hours || 0) * avgRate;
          }
        });

        console.log('Dashboard Stats - Direct calculation:', {
          employeeCount: uniqueEmployees.size,
          totalHours,
          totalPayroll,
          totalShifts,
          entriesFound: entries?.length || 0
        });

        stats = {
          employeeCount: uniqueEmployees.size,
          totalHours,
          totalPayroll,
          totalShifts
        };
      }

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
