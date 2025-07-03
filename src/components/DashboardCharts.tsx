
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      // Get last 6 months of data
      const sixMonthsAgo = subMonths(new Date(), 6);
      
      const { data: timesheets, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .gte('clock_in_date', format(sixMonthsAgo, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Process data for charts
      const monthlyData: Record<string, MonthlyData> = {};
      const employeeData: Record<string, EmployeeData> = {};
      
      timesheets?.forEach(entry => {
        const date = new Date(entry.clock_in_date);
        const monthKey = format(date, 'MMM yyyy');
        
        // Monthly data
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, hours: 0, amount: 0, shifts: 0 };
        }
        monthlyData[monthKey].hours += entry.total_hours;
        monthlyData[monthKey].amount += entry.total_card_amount_flat;
        monthlyData[monthKey].shifts += 1;
        
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
        employeeData[entry.employee_name].hours += entry.total_hours;
        employeeData[entry.employee_name].amount += entry.total_card_amount_flat;
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

      return {
        monthlyData: Object.values(monthlyData).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Monthly Hours Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData?.monthlyData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📈 Monthly Shifts Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData?.monthlyData}>
                <defs>
                  <linearGradient id="colorShifts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏆 Top Performers Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chartData?.employeeData?.map((employee, index) => (
              <div key={employee.name} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  {getLeaderIcon(index)}
                  <div>
                    <p className="font-semibold text-gray-900">{employee.name}</p>
                    <p className="text-sm text-gray-500">{employee.shifts} shifts</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
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

    </div>
  );
};

export default DashboardCharts;
