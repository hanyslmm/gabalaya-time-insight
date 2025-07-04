
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Trophy, Medal, Award, Star, Calendar, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const DashboardCharts: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState('30days');

  const getDateRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case '7days':
        return { from: subDays(now, 7), to: now, label: 'Last 7 Days' };
      case '30days':
        return { from: subDays(now, 30), to: now, label: 'Last 30 Days' };
      case '90days':
        return { from: subDays(now, 90), to: now, label: 'Last 3 Months' };
      case 'thisweek':
        return { from: startOfWeek(now), to: endOfWeek(now), label: 'This Week' };
      case 'thismonth':
        return { from: startOfMonth(now), to: endOfMonth(now), label: 'This Month' };
      case '6months':
        return { from: subMonths(now, 6), to: now, label: 'Last 6 Months' };
      case '1year':
        return { from: subMonths(now, 12), to: now, label: 'Last Year' };
      default:
        return { from: subDays(now, 30), to: now, label: 'Last 30 Days' };
    }
  };

  const dateRange = getDateRange();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['dashboard-charts', timePeriod, dateRange],
    queryFn: async () => {
      const { data: timesheets, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Process data for charts based on time period
      let groupingFormat = 'MMM dd';
      if (timePeriod === '6months' || timePeriod === '1year') {
        groupingFormat = 'MMM yyyy';
      } else if (timePeriod === '7days' || timePeriod === 'thisweek') {
        groupingFormat = 'EEE';
      }

      const timeData: Record<string, MonthlyData> = {};
      const employeeData: Record<string, EmployeeData> = {};
      
      timesheets?.forEach(entry => {
        const date = new Date(entry.clock_in_date);
        const timeKey = format(date, groupingFormat);
        
        // Time-based data
        if (!timeData[timeKey]) {
          timeData[timeKey] = { month: timeKey, hours: 0, amount: 0, shifts: 0 };
        }
        timeData[timeKey].hours += entry.total_hours || 0;
        timeData[timeKey].amount += entry.total_card_amount_flat || 0;
        timeData[timeKey].shifts += 1;
        
        // Employee data
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
        employeeData[entry.employee_name].amount += entry.total_card_amount_flat || 0;
        employeeData[entry.employee_name].shifts += 1;
      });
      
      // Calculate average hours and sort employees
      const sortedEmployees = Object.values(employeeData)
        .map((emp: EmployeeData) => ({
          ...emp,
          avgHours: emp.shifts > 0 ? emp.hours / emp.shifts : 0
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);

      const sortedTimeData = Object.values(timeData)
        .sort((a, b) => {
          if (timePeriod === '6months' || timePeriod === '1year') {
            return new Date(a.month).getTime() - new Date(b.month).getTime();
          }
          return a.month.localeCompare(b.month);
        });

      return {
        timeData: sortedTimeData,
        employeeData: sortedEmployees
      };
    }
  });

  const chartConfig = {
    hours: { label: 'Hours', color: 'hsl(var(--chart-1))' },
    amount: { label: 'Amount (LE)', color: 'hsl(var(--chart-2))' },
    shifts: { label: 'Shifts', color: 'hsl(var(--chart-3))' }
  };

  const getLeaderIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <Star className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLeaderBadge = (index: number) => {
    switch (index) {
      case 0: return <Badge className="bg-yellow-500 text-white">1st</Badge>;
      case 1: return <Badge className="bg-gray-400 text-white">2nd</Badge>;
      case 2: return <Badge className="bg-amber-600 text-white">3rd</Badge>;
      default: return <Badge variant="outline">{index + 1}th</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Time Period Filter */}
      <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">Analytics Dashboard</h3>
                <p className="text-sm text-muted-foreground">Showing data for {dateRange.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-accent" />
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-48 bg-background border-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-primary/20">
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="thisweek">This Week</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="thismonth">This Month</SelectItem>
                  <SelectItem value="90days">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InteractiveChart title={`Hours Trend - ${dateRange.label}`}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Hours Trend - {dateRange.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData?.timeData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="hsl(var(--chart-1))" 
                      fillOpacity={1} 
                      fill="url(#colorHours)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </InteractiveChart>

        <InteractiveChart title={`Activity Overview - ${dateRange.label}`}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📈 Activity Overview - {dateRange.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData?.timeData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                    <defs>
                      <linearGradient id="colorShifts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="shifts" 
                      fill="url(#colorShifts)" 
                      radius={[4, 4, 0, 0]}
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={1}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </InteractiveChart>

        <div className="md:col-span-2">
          <InteractiveChart title={`Top Performers - ${dateRange.label}`}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🏆 Top Performers - {dateRange.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chartData?.employeeData?.map((employee, index) => (
                    <div key={employee.name} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-lg border hover:shadow-lg transition-all duration-200 hover:scale-105">
                      <div className="flex items-center gap-3">
                        {getLeaderIcon(index)}
                        <div>
                          <p className="font-semibold text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-500">{employee.shifts} shifts</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-bold text-lg text-blue-600">{employee.hours.toFixed(1)}h</p>
                          <p className="text-xs text-gray-500">LE {employee.amount.toFixed(0)}</p>
                        </div>
                        {getLeaderBadge(index)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </InteractiveChart>
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;
