import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';

interface MonthlyData {
  month: string;
  hours: number;
  amount: number;
  shifts: number;
}


interface DashboardChartsProps {
  timePeriod?: 'week' | 'month' | 'quarter' | 'year';
  dateRange?: {
    from: Date;
    to: Date;
  };
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
  timePeriod = 'month',
  dateRange 
}) => {
  // Simplified to only show overview - removed performance and activity views

  const calculateDateRange = () => {
    if (dateRange) {
      return {
        from: dateRange.from,
        to: dateRange.to,
        label: `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
      };
    }

    const today = new Date();
    
    switch (timePeriod) {
      case 'week':
        return {
          from: startOfWeek(today),
          to: endOfWeek(today),
          label: 'This Week'
        };
      case 'quarter':
        return {
          from: subMonths(today, 3),
          to: today,
          label: 'Last 3 Months'
        };
      case 'year':
        return {
          from: subMonths(today, 12),
          to: today,
          label: 'Last Year'
        };
      default:
        return {
          from: startOfMonth(today),
          to: endOfMonth(today),
          label: 'This Month'
        };
    }
  };

  const effectiveDateRange = calculateDateRange();

  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['dashboard-charts', effectiveDateRange.from, effectiveDateRange.to, timePeriod, activeOrganizationId],
    queryFn: async () => {
      const fromDate = format(effectiveDateRange.from, 'yyyy-MM-dd');
      const toDate = format(effectiveDateRange.to, 'yyyy-MM-dd');

      // Load employees in current org to properly match legacy rows (organization_id is null)
      const { data: orgEmployees } = await supabase
        .from('employees')
        .select('id, staff_id, full_name')
        .eq('organization_id', activeOrganizationId)
        .order('full_name');

      const employeeRows = orgEmployees || [];
      const employeeIds = employeeRows.map((e: any) => e.id);
      const employeeStaffIds = employeeRows.map((e: any) => e.staff_id).filter(Boolean);
      const employeeNames = employeeRows.map((e: any) => e.full_name).filter(Boolean);

      // Helper: apply date filter
      const applyDateFilter = (q: any) => q.gte('clock_in_date', fromDate).lte('clock_in_date', toDate);

      // Query A: strictly current organization
      let queryOrg = supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees!inner(
            morning_wage_rate,
            night_wage_rate,
            full_name
          )
        `)
        .order('clock_in_date');
      if (activeOrganizationId) queryOrg = queryOrg.eq('organization_id', activeOrganizationId);
      queryOrg = applyDateFilter(queryOrg);

      // Query B: legacy rows with null organization, matched to org employees
      let queryLegacy = supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees!inner(
            morning_wage_rate,
            night_wage_rate,
            full_name
          )
        `)
        .is('organization_id', null)
        .order('clock_in_date');
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

      // STRICT FILTERING: Only use organization_id match
      const resOrg = await queryOrg;

      if (resOrg.error) throw resOrg.error;

      // Use ONLY organization-scoped data
      const timesheetData = resOrg.data || [];

      // Debug logging
      console.log('Dashboard Charts - Loaded', timesheetData.length, 'entries for period', fromDate, 'to', toDate);

      // Process data for charts
      const monthlyDataMap = new Map<string, { hours: number; amount: number; shifts: number }>();
      timesheetData?.forEach(entry => {
        // Monthly data
        const monthKey = format(new Date(entry.clock_in_date), 'MMM yyyy');
        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, { hours: 0, amount: 0, shifts: 0 });
        }
        const monthData = monthlyDataMap.get(monthKey)!;
        const hours = entry.total_hours || 0;
        
        // Calculate amount based on available data
        let calculatedAmount = 0;
        if (entry.total_card_amount_split) {
          calculatedAmount = entry.total_card_amount_split;
        } else if (entry.total_card_amount_flat) {
          calculatedAmount = entry.total_card_amount_flat;
        } else if (hours > 0) {
          // Fallback: calculate from wage rates
          const morningRate = entry.employees?.morning_wage_rate || 20;
          const nightRate = entry.employees?.night_wage_rate || 20;
          const avgRate = (morningRate + nightRate) / 2;
          calculatedAmount = hours * avgRate;
        }
        
        monthData.hours += hours;
        monthData.amount += calculatedAmount;
        monthData.shifts += 1;
      });

      const monthlyData: MonthlyData[] = Array.from(monthlyDataMap.entries()).map(([month, data]) => ({
        month,
        ...data
      }));

      return {
        monthlyData
      };
    }
  });

  const chartConfig = {
    hours: { label: 'Hours', color: 'hsl(var(--primary))' },
    amount: { label: 'Amount (LE)', color: 'hsl(var(--secondary))' },
    shifts: { label: 'Shifts', color: 'hsl(var(--accent))' }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="animate-pulse">
              <div className="h-64 bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Charts Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analytics Overview</h3>
      </div>

      {/* Chart Content */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-full bg-gradient-to-br from-card via-card/95 to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="border-b border-border/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <LineChartIcon className="h-5 w-5 text-primary" />
                  </div>
                   <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                     Weekly Hours Trend
                   </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData?.monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="hours" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorHours)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="h-full bg-gradient-to-br from-card via-card/95 to-secondary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="border-b border-border/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                    <BarChart3 className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                    Monthly Shifts & Revenue
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData?.monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'hsl(var(--secondary))', fillOpacity: 0.1 }}
                      />
                      <Bar 
                        dataKey="shifts" 
                        fill="hsl(var(--secondary))" 
                        radius={[4, 4, 0, 0]}
                        strokeWidth={1}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
};

export default DashboardCharts;