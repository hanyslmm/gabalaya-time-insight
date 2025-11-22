import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Area, AreaChart, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, eachDayOfInterval, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Users, 
  Activity, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';

interface DashboardChartsProps {
  timePeriod?: 'week' | 'month' | 'quarter' | 'year';
  dateRange?: {
    from: Date;
    to: Date;
  };
  roleFilter?: string;
}

interface DailyData {
  date: string;
  dateLabel: string;
  hours: number;
  shifts: number;
  payroll: number;
  employees: number;
  attendanceRate: number;
}

interface EmployeeProductivity {
  name: string;
  hours: number;
  shifts: number;
  payroll: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4'
];

const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
  timePeriod = 'month',
  dateRange,
  roleFilter = 'all'
}) => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  // Use dateRange from props if provided, otherwise calculate based on timePeriod
  const effectiveDateRange = dateRange || (() => {
    const today = new Date();
    const daysBack = timePeriod === 'week' ? 7 : timePeriod === 'quarter' ? 90 : timePeriod === 'year' ? 365 : 30;
    return {
      from: new Date(today.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000),
      to: today
    };
  })();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['dashboard-charts-strategic', effectiveDateRange.from, effectiveDateRange.to, activeOrganizationId, roleFilter],
    queryFn: async () => {
      const fromDate = format(effectiveDateRange.from, 'yyyy-MM-dd');
      const toDate = format(effectiveDateRange.to, 'yyyy-MM-dd');

      if (!activeOrganizationId) {
        return { 
          dailyData: [], 
          employeeProductivity: [],
          summary: { totalDays: 0, avgDailyHours: 0, avgDailyPayroll: 0 }
        };
      }

      // Load employees for the current organization, optionally filtered by role
      let employeesQuery = supabase
        .from('employees')
        .select('id, staff_id, full_name, organization_id, role')
        .eq('organization_id', activeOrganizationId);
      
      // Apply role filter if not 'all'
      if (roleFilter && roleFilter !== 'all') {
        employeesQuery = employeesQuery.eq('role', roleFilter);
      }
      
      const { data: employees } = await employeesQuery;

      const employeeRows = employees || [];
      const employeeIds = employeeRows.map((e: any) => e.id);

      // Get employee IDs for role filtering
      const employeeIdsForRole = roleFilter !== 'all' 
        ? employees.filter((emp: any) => emp.role === roleFilter).map((emp: any) => emp.id)
        : employees.map((emp: any) => emp.id);

      // Load timesheet entries, filtered by role if specified
      let entriesQuery = supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees!inner(id, morning_wage_rate, night_wage_rate, organization_id, role)
        `)
        .eq('organization_id', activeOrganizationId)
        .gte('clock_in_date', fromDate)
        .lte('clock_in_date', toDate);
      
      if (roleFilter !== 'all' && employeeIdsForRole.length > 0) {
        entriesQuery = entriesQuery.in('employee_id', employeeIdsForRole);
      }
      
      const { data: entries, error } = await entriesQuery.order('clock_in_date', { ascending: true });

      if (error) throw error;

      const validEntries = (entries || []).filter((entry: any) => 
        entry.organization_id === activeOrganizationId
      );

      // Generate all days in the range
      const days = eachDayOfInterval({
        start: effectiveDateRange.from,
        end: effectiveDateRange.to
      });

      // Process daily data
      const dailyDataMap = new Map<string, DailyData>();
      const employeeStatsMap = new Map<string, { hours: number; shifts: number; payroll: number }>();

      days.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayLabel = format(day, 'MMM dd');
        dailyDataMap.set(dayKey, {
          date: dayKey,
          dateLabel: dayLabel,
          hours: 0,
          shifts: 0,
          payroll: 0,
          employees: 0,
          attendanceRate: 0
        });
      });

      // Process entries
      const uniqueEmployeesPerDay = new Map<string, Set<string>>();

      validEntries.forEach((entry: any) => {
        const dayKey = entry.clock_in_date;
        const dayData = dailyDataMap.get(dayKey);
        
        if (dayData) {
          const hours = entry.total_hours || 0;
          dayData.hours += hours;
          dayData.shifts += 1;
          
          // Calculate payroll
          let payroll = 0;
        if (entry.total_card_amount_split) {
            payroll = entry.total_card_amount_split;
        } else if (entry.total_card_amount_flat) {
            payroll = entry.total_card_amount_flat;
          } else if (hours > 0 && entry.employees) {
            const morningRate = entry.employees.morning_wage_rate || 20;
            const nightRate = entry.employees.night_wage_rate || 20;
          const avgRate = (morningRate + nightRate) / 2;
            payroll = hours * avgRate;
          }
          dayData.payroll += payroll;

          // Track unique employees per day
          if (!uniqueEmployeesPerDay.has(dayKey)) {
            uniqueEmployeesPerDay.set(dayKey, new Set());
          }
          const empId = entry.employee_id || entry.employee_name;
          uniqueEmployeesPerDay.get(dayKey)!.add(empId);

          // Track employee productivity
          const empKey = entry.employee_name || 'Unknown';
          if (!employeeStatsMap.has(empKey)) {
            employeeStatsMap.set(empKey, { hours: 0, shifts: 0, payroll: 0 });
          }
          const empStats = employeeStatsMap.get(empKey)!;
          empStats.hours += hours;
          empStats.shifts += 1;
          empStats.payroll += payroll;
        }
      });

      // Calculate attendance rate per day
      dailyDataMap.forEach((dayData, dayKey) => {
        const uniqueCount = uniqueEmployeesPerDay.get(dayKey)?.size || 0;
        dayData.employees = uniqueCount;
        dayData.attendanceRate = employeeRows.length > 0 
          ? (uniqueCount / employeeRows.length) * 100 
          : 0;
      });

      const dailyData: DailyData[] = Array.from(dailyDataMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top 8 employees by hours
      const employeeProductivity: EmployeeProductivity[] = Array.from(employeeStatsMap.entries())
        .map(([name, stats]) => ({
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          ...stats
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      // Summary stats
      const totalDays = dailyData.length;
      const totalHours = dailyData.reduce((sum, d) => sum + d.hours, 0);
      const totalPayroll = dailyData.reduce((sum, d) => sum + d.payroll, 0);
      const avgDailyHours = totalDays > 0 ? totalHours / totalDays : 0;
      const avgDailyPayroll = totalDays > 0 ? totalPayroll / totalDays : 0;

      return {
        dailyData,
        employeeProductivity,
        summary: {
          totalDays,
          avgDailyHours,
          avgDailyPayroll
        }
      };
    },
    enabled: !!activeOrganizationId
  });

  const chartConfig = {
    hours: { label: 'Hours', color: 'hsl(var(--primary))' },
    shifts: { label: 'Shifts', color: 'hsl(var(--secondary))' },
    payroll: { label: 'Payroll (LE)', color: 'hsl(var(--accent))' },
    employees: { label: 'Employees', color: '#10b981' },
    attendanceRate: { label: 'Attendance %', color: '#8b5cf6' }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-gradient-to-br from-card to-card/90">
              <CardContent className="p-6">
                <div className="animate-pulse h-64 bg-muted/20 rounded-lg"></div>
              </CardContent>
            </Card>
          ))}
        </div>
            </div>
    );
  }

  if (!chartData || chartData.dailyData.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-card to-card/90">
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No data available for the selected period</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if we should show daily or weekly aggregation based on date range
  const daysDiff = differenceInDays(effectiveDateRange.to, effectiveDateRange.from);
  const showDaily = daysDiff <= 30;

  return (
    <div className="space-y-6">
      {/* Charts Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Strategic Analytics</h3>
          <p className="text-sm text-foreground/80 mt-1 font-medium">
            Insights for data-driven decision making
          </p>
        </div>
      </div>

      {/* Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Activity Trend (Hours & Shifts) */}
        <Card className="bg-gradient-to-br from-card via-card/95 to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
              <span className="text-foreground">
                Daily Activity Trend
                   </span>
                </CardTitle>
            <p className="text-sm text-foreground/80 mt-2 font-medium">
              Hours worked and shifts completed over time
            </p>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                    dataKey="dateLabel" 
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                      />
                      <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                      />
                      <ChartTooltip 
                    content={<ChartTooltipContent className="font-semibold" />}
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '3 3' }}
                      />
                      <Area 
                    yAxisId="left"
                        type="monotone" 
                        dataKey="hours" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        fill="url(#colorHours)" 
                      />
                  <Bar
                    yAxisId="right"
                    dataKey="shifts"
                    fill="hsl(var(--secondary))"
                    radius={[4, 4, 0, 0]}
                    opacity={0.9}
                  />
                </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

        {/* Chart 2: Payroll Trend */}
        <Card className="bg-gradient-to-br from-card via-card/95 to-secondary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-foreground">
                Daily Payroll Trend
              </span>
            </CardTitle>
            <p className="text-sm text-foreground/80 mt-2 font-medium">
              Payroll costs over time with trend analysis
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="dateLabel" 
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent className="font-semibold" />}
                    formatter={(value: number) => [`${value.toFixed(0)} LE`, 'Payroll']}
                    cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 2, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="payroll"
                    stroke="hsl(var(--accent))"
                    strokeWidth={3}
                    fill="url(#colorPayroll)"
                  />
                  <Line
                    type="monotone"
                    dataKey="payroll"
                    stroke="hsl(var(--accent))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-foreground/80 font-medium">
                Avg Daily: <span className="font-bold text-foreground">{chartData.summary.avgDailyPayroll.toFixed(0)} LE</span>
              </div>
              <div className="text-foreground/80 font-medium">
                Total Days: <span className="font-bold text-foreground">{chartData.summary.totalDays}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Attendance Rate Trend */}
        <Card className="bg-gradient-to-br from-card via-card/95 to-accent/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Users className="h-5 w-5 text-accent" />
                  </div>
              <span className="text-foreground">
                Attendance Rate Trend
                  </span>
                </CardTitle>
            <p className="text-sm text-foreground/80 mt-2 font-medium">
              Daily attendance percentage and active employees
            </p>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                    dataKey="dateLabel" 
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                    label={{ value: 'Attendance %', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 } }}
                      />
                      <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                    label={{ value: 'Employees', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 } }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                    cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                      />
                      <Bar 
                    yAxisId="right"
                    dataKey="employees"
                    fill="#10b981"
                        radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="attendanceRate"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Chart 4: Top Performers Productivity */}
        <Card className="bg-gradient-to-br from-card via-card/95 to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-foreground">
                Top Performers
              </span>
            </CardTitle>
            <p className="text-sm text-foreground/80 mt-2 font-medium">
              Hours worked by top 8 employees
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={chartData.employeeProductivity} 
                  margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    type="number"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--foreground))" 
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                    fontWeight={500}
                    width={100}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent className="font-semibold" />}
                    cursor={{ fill: 'hsl(var(--primary))', fillOpacity: 0.15 }}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  >
                    {chartData.employeeProductivity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
      </div>
    </div>
  );
};

export default DashboardCharts;
