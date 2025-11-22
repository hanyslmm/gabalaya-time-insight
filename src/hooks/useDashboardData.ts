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
  averageHoursPerEmployee: number;
  attendanceRate: number;
  topPerformers: Array<{
    name: string;
    hours: number;
    shifts: number;
  }>;
  recentActivity: Array<{
    employee_name: string;
    clock_in_date: string;
    clock_in_time: string;
    total_hours: number;
  }>;
}

export const useDashboardData = (dateRange: DateRange, enabled: boolean = true, roleFilter: string = 'all') => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  // Add logging to debug organization scoping
  console.log('useDashboardData - activeOrganizationId:', activeOrganizationId);
  console.log('useDashboardData - roleFilter:', roleFilter);
  console.log('useDashboardData - user object:', { 
    current_organization_id: (user as any)?.current_organization_id,
    organization_id: user?.organization_id 
  });
  
  return useQuery({
    queryKey: ['dashboard-data', format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'), activeOrganizationId, roleFilter],
    queryFn: async (): Promise<DashboardData> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      console.log('useDashboardData - Fetching data for organization:', activeOrganizationId, 'from', fromDate, 'to', toDate);

      // Skip RPC function - it's not organization-scoped in the latest migration
      // Always use direct query to ensure strict organization filtering
      let stats: any = null;
      
      // STRICT ORGANIZATION SCOPING: Always use direct query with explicit organization filter
      // Load employees for the current organization ONLY
      if (!activeOrganizationId) {
        console.warn('useDashboardData - No activeOrganizationId, returning empty stats');
        return {
          employeeCount: 0,
          totalHours: 0,
          totalPayroll: 0,
          totalShifts: 0,
          averageHoursPerEmployee: 0,
          attendanceRate: 0,
          topPerformers: [],
          recentActivity: []
        };
      }

      // Load employees ONLY for the current organization, optionally filtered by role
      let employeesQuery = supabase
        .from('employees')
        .select('id, staff_id, full_name, role')
        .eq('organization_id', activeOrganizationId);
      
      // Apply role filter if not 'all'
      if (roleFilter && roleFilter !== 'all') {
        employeesQuery = employeesQuery.eq('role', roleFilter);
      }
      
      const { data: employees, error: employeesError } = await employeesQuery;

      if (employeesError) {
        console.error('useDashboardData - Error loading employees:', employeesError);
        throw employeesError;
      }

        const employeeRows = employees || [];
      console.log('useDashboardData - Found', employeeRows.length, 'employees for organization', activeOrganizationId);

        const employeeIds = employeeRows.map((e: any) => e.id);
        const employeeStaffIds = employeeRows.map((e: any) => e.staff_id).filter(Boolean);
        const employeeNames = employeeRows.map((e: any) => e.full_name).filter(Boolean);

        const applyDateFilter = (q: any) =>
          q.gte('clock_in_date', fromDate).lte('clock_in_date', toDate);

      // Get employee IDs for role filtering
      const employeeIdsForRole = roleFilter !== 'all' && employeeRows.length > 0
        ? employeeRows.filter((emp: any) => emp.role === roleFilter).map((emp: any) => emp.id)
        : employeeRows.map((emp: any) => emp.id);

      // STRICT QUERY: Only get timesheet entries for the current organization
      // Use inner join with employees to ensure we only get entries for employees in this org
      let queryOrg = supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees!inner(id, morning_wage_rate, night_wage_rate, organization_id, role)
        `)
        .eq('organization_id', activeOrganizationId); // STRICT: Must match organization_id
      
      // Filter by employee IDs if role filter is applied
      if (roleFilter !== 'all' && employeeIdsForRole.length > 0) {
        queryOrg = queryOrg.in('employee_id', employeeIdsForRole);
      }
      
      queryOrg = applyDateFilter(queryOrg);

      // Execute query - this will ONLY return entries for the current organization
      const resOrg = await queryOrg;
      if (resOrg.error) {
        console.error('useDashboardData - Error querying timesheet entries:', resOrg.error);
        throw resOrg.error;
      }
      
      const entries = resOrg.data || [];
      console.log('useDashboardData - Found', entries.length, 'timesheet entries for organization', activeOrganizationId);
      
      // Additional validation: Filter out any entries that don't match organization_id or role (safety check)
      const validEntries = entries.filter((entry: any) => {
        // Check if entry has organization_id matching
        if (entry.organization_id !== activeOrganizationId) {
          console.warn('useDashboardData - Entry has mismatched organization_id:', entry.id, 'expected:', activeOrganizationId, 'got:', entry.organization_id);
          return false;
        }
        // Also check employee's organization_id if available
        if (entry.employees && entry.employees.organization_id !== activeOrganizationId) {
          console.warn('useDashboardData - Employee has mismatched organization_id:', entry.employee_id);
          return false;
        }
        // Check role filter if specified
        if (roleFilter !== 'all' && entry.employees && entry.employees.role !== roleFilter) {
          return false;
        }
        return true;
      });
      
      console.log('useDashboardData - Valid entries after filtering:', validEntries.length, 'out of', entries.length);

      // Calculate stats manually using ONLY valid entries
      // Count distinct employees who have at least one clock-in during the period
      const uniqueEmployeeIds = new Set<string>(); // Use employee_id for accurate counting
      const uniqueEmployeeNames = new Set<string>(); // Fallback for entries without employee_id
      const employeeHoursMap = new Map<string, number>();
      const employeeShiftsMap = new Map<string, number>();
        let totalHours = 0;
        let totalPayroll = 0;
      let totalShifts = validEntries?.length || 0;

      validEntries?.forEach(entry => {
        // Count unique employees: prefer employee_id, fallback to employee_name
        if (entry.employee_id) {
          uniqueEmployeeIds.add(entry.employee_id);
        } else if (entry.employee_name) {
          uniqueEmployeeNames.add(entry.employee_name);
        }
        
        const empName = entry.employee_name || 'Unknown';
        const hours = entry.total_hours || 0;
        totalHours += hours;
        
        // Track per-employee stats
        employeeHoursMap.set(empName, (employeeHoursMap.get(empName) || 0) + hours);
        employeeShiftsMap.set(empName, (employeeShiftsMap.get(empName) || 0) + 1);
          
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

      // Calculate employee count: employees with at least one clock-in during the period
      // Use employee_id count first (more accurate), add unique names for entries without IDs
      const employeeCount = uniqueEmployeeIds.size + uniqueEmployeeNames.size;
      const averageHoursPerEmployee = employeeCount > 0 ? totalHours / employeeCount : 0;

      // Calculate attendance rate (employees who worked at least one shift)
      const totalEmployeesInOrg = employeeRows.length;
      const attendanceRate = totalEmployeesInOrg > 0 
        ? (employeeCount / totalEmployeesInOrg) * 100 
        : 0;

      // Get top performers (top 5 by hours)
      const topPerformers = Array.from(employeeHoursMap.entries())
        .map(([name, hours]) => ({
          name,
          hours,
          shifts: employeeShiftsMap.get(name) || 0
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);

      // Get recent activity (last 10 entries, sorted by date/time)
      const recentActivity = validEntries
        .sort((a, b) => {
          const dateA = new Date(`${a.clock_in_date}T${a.clock_in_time || '00:00:00'}`);
          const dateB = new Date(`${b.clock_in_date}T${b.clock_in_time || '00:00:00'}`);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10)
        .map(entry => ({
          employee_name: entry.employee_name || 'Unknown',
          clock_in_date: entry.clock_in_date,
          clock_in_time: entry.clock_in_time || '',
          total_hours: entry.total_hours || 0
        }));

      console.log('useDashboardData - Final stats for organization', activeOrganizationId, ':', {
        employeeCount: `${employeeCount} (${uniqueEmployeeIds.size} by ID, ${uniqueEmployeeNames.size} by name)`,
          totalHours,
          totalPayroll,
          totalShifts,
        averageHoursPerEmployee,
        attendanceRate,
        entriesFound: validEntries?.length || 0
        });

        stats = {
        employeeCount,
          totalHours,
          totalPayroll,
        totalShifts,
        averageHoursPerEmployee,
        attendanceRate,
        topPerformers,
        recentActivity
      };

      return {
        employeeCount: stats?.employeeCount || 0,
        totalHours: stats?.totalHours || 0,
        totalPayroll: stats?.totalPayroll || 0,
        totalShifts: stats?.totalShifts || 0,
        averageHoursPerEmployee: stats?.averageHoursPerEmployee || 0,
        attendanceRate: stats?.attendanceRate || 0,
        topPerformers: stats?.topPerformers || [],
        recentActivity: stats?.recentActivity || []
      } as DashboardData;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
