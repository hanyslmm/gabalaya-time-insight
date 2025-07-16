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
  weeklyData: Array<{
    week: string;
    hours: number;
    amount: number;
  }>;
  topPerformers: Array<{
    employee_name: string;
    total_hours: number;
    total_amount: number;
  }>;
}

export const useDashboardData = (dateRange: DateRange, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dashboard-data', dateRange],
    queryFn: async (): Promise<DashboardData> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch all data in parallel for better performance
      const [
        employeeCountResult,
        timesheetSummaryResult,
        weeklyDataResult,
        topPerformersResult
      ] = await Promise.all([
        // Employee count
        supabase
          .from('employees')
          .select('*', { count: 'exact', head: true }),

        // Timesheet summary
        supabase
          .from('timesheet_entries')
          .select('total_hours, total_card_amount_flat, total_card_amount_split, employee_name')
          .gte('clock_in_date', fromDate)
          .lte('clock_in_date', toDate),

        // Weekly data for charts - using direct query since RPC doesn't exist
        supabase
          .from('timesheet_entries')
          .select('clock_in_date, total_hours, total_card_amount_flat, total_card_amount_split')
          .gte('clock_in_date', fromDate)
          .lte('clock_in_date', toDate)
          .order('clock_in_date'),

        // Top performers
        supabase
          .from('timesheet_entries')
          .select('employee_name, total_hours, total_card_amount_flat, total_card_amount_split')
          .gte('clock_in_date', fromDate)
          .lte('clock_in_date', toDate)
      ]);

      if (employeeCountResult.error) throw employeeCountResult.error;
      if (timesheetSummaryResult.error) throw timesheetSummaryResult.error;
      if (weeklyDataResult.error) throw weeklyDataResult.error;
      if (topPerformersResult.error) throw topPerformersResult.error;

      // Process timesheet summary
      const timesheetData = timesheetSummaryResult.data || [];
      const totalHours = timesheetData.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
      const totalPayroll = timesheetData.reduce((sum, entry) => 
        sum + (entry.total_card_amount_split || entry.total_card_amount_flat || 0), 0
      );
      const totalShifts = timesheetData.length;

      // Process weekly data
      let weeklyData: Array<{ week: string; hours: number; amount: number; }> = [];
      
      if (weeklyDataResult.data && Array.isArray(weeklyDataResult.data)) {
        // Group by week if we have raw data
        const weeklyGroups = new Map<string, { hours: number; amount: number }>();
        
        weeklyDataResult.data.forEach((entry: any) => {
          const date = new Date(entry.clock_in_date);
          const weekKey = `Week ${Math.ceil(date.getDate() / 7)}`;
          
          if (!weeklyGroups.has(weekKey)) {
            weeklyGroups.set(weekKey, { hours: 0, amount: 0 });
          }
          
          const group = weeklyGroups.get(weekKey)!;
          group.hours += entry.total_hours || 0;
          group.amount += entry.total_card_amount_split || entry.total_card_amount_flat || 0;
        });

        weeklyData = Array.from(weeklyGroups.entries()).map(([week, data]) => ({
          week,
          hours: data.hours,
          amount: data.amount
        }));
      }

      // Process top performers
      const performerGroups = new Map<string, { hours: number; amount: number }>();
      
      (topPerformersResult.data || []).forEach((entry: any) => {
        const employeeName = entry.employee_name;
        
        if (!performerGroups.has(employeeName)) {
          performerGroups.set(employeeName, { hours: 0, amount: 0 });
        }
        
        const performer = performerGroups.get(employeeName)!;
        performer.hours += entry.total_hours || 0;
        performer.amount += entry.total_card_amount_split || entry.total_card_amount_flat || 0;
      });

      const topPerformers = Array.from(performerGroups.entries())
        .map(([employee_name, data]) => ({
          employee_name,
          total_hours: data.hours,
          total_amount: data.amount
        }))
        .sort((a, b) => b.total_hours - a.total_hours)
        .slice(0, 10);

      return {
        employeeCount: employeeCountResult.count || 0,
        totalHours,
        totalPayroll,
        totalShifts,
        weeklyData,
        topPerformers
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};