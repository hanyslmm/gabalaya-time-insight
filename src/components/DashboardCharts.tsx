
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Trophy, Medal, Award, Star, Calendar, TrendingUp, BarChart3, LineChart as LineChartIcon, Activity, Zap, Target, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InteractiveChart from './InteractiveChart';

interface MonthlyData {
  month: string;
  hours: number;
  amount: number;
  shifts: number;
}

interface EmployeeData {
  name: string;
  hours: number;
  amount: number;
  shifts: number;
  avgHours: number;
}

interface DashboardChartsProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
  timePeriod = '30days',
  dateRange 
}) => {
  const [chartView, setChartView] = useState('overview');

  const effectiveDateRange = dateRange || {
    from: subDays(new Date(), 30),
    to: new Date(),
    label: 'Last 30 Days'
  };

  // Determine grouping format based on date range
  const daysDifference = Math.ceil((effectiveDateRange.to.getTime() - effectiveDateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  let groupingFormat = 'MMM dd';
  
  if (daysDifference > 60) {
    groupingFormat = 'MMM yyyy';
  } else if (daysDifference <= 7) {
    groupingFormat = 'EEE';
  }

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['dashboard-charts', timePeriod, effectiveDateRange],
    queryFn: async () => {
      let query = supabase.from('timesheet_entries').select('*');
      
      query = query
        .gte('clock_in_date', format(effectiveDateRange.from, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(effectiveDateRange.to, 'yyyy-MM-dd'));
      
      const { data: timesheets, error } = await query;
      
      if (error) throw error;
      
      // Use the pre-calculated grouping format based on actual date range

      const timeData: Record<string, MonthlyData> = {};
      const employeeData: Record<string, EmployeeData> = {};
      const hourlyData: Array<{ hour: number; activity: number }> = Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: 0 }));
      
      timesheets?.forEach(entry => {
        const date = new Date(entry.clock_in_date);
        const timeKey = format(date, groupingFormat);
        
        // Time-based data with enhanced metrics
        if (!timeData[timeKey]) {
          timeData[timeKey] = { month: timeKey, hours: 0, amount: 0, shifts: 0 };
        }
        timeData[timeKey].hours += entry.total_hours || 0;
        timeData[timeKey].amount += Math.round(entry.total_card_amount_flat || 0);
        timeData[timeKey].shifts += 1;
        
        // Employee performance data
        if (!employeeData[entry.employee_name]) {
          employeeData[entry.employee_name] = { 
            name: entry.employee_name, 
            hours: 0, 
            amount: 0, 
            shifts: 0,
            avgHours: 0 
          };
        }
        employeeData[entry.employee_name].hours += entry.total_hours || 0;
        employeeData[entry.employee_name].amount += Math.round(entry.total_card_amount_flat || 0);
        employeeData[entry.employee_name].shifts += 1;

        // Hourly activity tracking
        if (entry.clock_in_time) {
          const hour = parseInt(entry.clock_in_time.split(':')[0]);
          if (hour >= 0 && hour < 24) {
            hourlyData[hour].activity += 1;
          }
        }
      });
      
      // Calculate metrics and sort data
      const sortedEmployees = Object.values(employeeData)
        .map((emp: EmployeeData) => ({
          ...emp,
          avgHours: emp.shifts > 0 ? emp.hours / emp.shifts : 0,
          efficiency: emp.shifts > 0 ? (emp.amount / emp.hours) : 0
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      const sortedTimeData = Object.values(timeData)
        .sort((a, b) => {
          if (timePeriod === '6months' || timePeriod === '1year' || timePeriod === 'alltime') {
            return new Date(a.month).getTime() - new Date(b.month).getTime();
          }
          return a.month.localeCompare(b.month);
        });

      // Performance metrics
      const totalMetrics = {
        totalHours: sortedTimeData.reduce((sum, d) => sum + d.hours, 0),
        totalAmount: sortedTimeData.reduce((sum, d) => sum + d.amount, 0),
        totalShifts: sortedTimeData.reduce((sum, d) => sum + d.shifts, 0),
        avgHoursPerShift: sortedTimeData.reduce((sum, d) => sum + d.hours, 0) / Math.max(sortedTimeData.reduce((sum, d) => sum + d.shifts, 0), 1),
        peakHour: hourlyData.reduce((max, curr) => curr.activity > max.activity ? curr : max, hourlyData[0])
      };

      return {
        timeData: sortedTimeData,
        employeeData: sortedEmployees,
        hourlyData: hourlyData.filter(h => h.activity > 0),
        metrics: totalMetrics
      };
    }
  });

  const chartConfig = {
    hours: { label: 'Hours', color: 'hsl(var(--primary))' },
    amount: { label: 'Amount (LE)', color: 'hsl(var(--secondary))' },
    shifts: { label: 'Shifts', color: 'hsl(var(--accent))' },
    activity: { label: 'Activity', color: 'hsl(var(--success))' }
  };

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))', 
    'hsl(var(--accent))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
    'hsl(340 75% 55%)',
    'hsl(210 75% 55%)',
    'hsl(120 75% 45%)'
  ];

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
    <div className="space-y-6 animate-fade-in">
      {/* Enhanced Charts Grid */}
      <Tabs value={chartView} onValueChange={setChartView} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-background/50 backdrop-blur border border-border/50">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                    <AreaChart data={chartData?.timeData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
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
                        fillOpacity={1} 
                        fill="url(#colorHours)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
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
                   <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                     Daily Cost Analysis
                   </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData?.timeData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'hsl(var(--secondary) / 0.1)' }}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="url(#colorAmount)" 
                        radius={[6, 6, 0, 0]}
                        stroke="hsl(var(--secondary))"
                        strokeWidth={1}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card className="bg-gradient-to-br from-card via-card/95 to-accent/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-border/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Trophy className="h-5 w-5 text-accent" />
                  </div>
                  <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                    Top Performers - {effectiveDateRange.label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {chartData?.employeeData?.slice(0, 4).map((employee, index) => (
                    <div key={employee.name} className="group relative">
                      <div className="flex flex-col items-center p-6 bg-gradient-to-br from-background/80 via-background/60 to-primary/5 rounded-2xl border border-border/50 hover:border-primary/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                        <div className="flex items-center gap-3 mb-4">
                          {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                          {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                          {index === 2 && <Award className="h-5 w-5 text-amber-600" />}
                          {index === 3 && <Star className="h-4 w-4 text-blue-500" />}
                          <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-xs">
                            {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}
                          </Badge>
                        </div>
                        <div className="text-center space-y-2">
                          <h4 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                            {employee.name}
                          </h4>
                          <div className="space-y-1">
                            <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              {Math.round(employee.hours)}h
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {Math.round(employee.amount)} LE • {employee.shifts} shifts
                            </p>
                            <div className="w-full bg-muted/30 rounded-full h-2 mt-3">
                              <div 
                                className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min((employee.hours / (chartData?.employeeData?.[0]?.hours || 1)) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-full bg-gradient-to-br from-card via-card/95 to-success/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="border-b border-border/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                    <Activity className="h-5 w-5 text-success" />
                  </div>
                  <span className="bg-gradient-to-r from-success to-accent bg-clip-text text-transparent">
                    Hourly Activity
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData?.hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="hour" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `${value}:00`}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        cursor={{ stroke: 'hsl(var(--success))', strokeWidth: 1, strokeDasharray: '3 3' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="activity" 
                        stroke="hsl(var(--success))" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--success))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                        activeDot={{ r: 6, fill: 'hsl(var(--success))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="h-full bg-gradient-to-br from-card via-card/95 to-warning/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="border-b border-border/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/20 transition-colors">
                    <Target className="h-5 w-5 text-warning" />
                  </div>
                  <span className="bg-gradient-to-r from-warning to-accent bg-clip-text text-transparent">
                    Distribution
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData?.employeeData?.slice(0, 6).map((emp, index) => ({
                          name: emp.name,
                          value: Math.round(emp.hours),
                          fill: CHART_COLORS[index % CHART_COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData?.employeeData?.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardCharts;
