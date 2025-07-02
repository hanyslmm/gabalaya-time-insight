
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
      const monthlyData = {};
      const employeeData = {};
      
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
          employeeData[entry.employee_name] = { name: entry.employee_name, hours: 0, amount: 0 };
        }
        employeeData[entry.employee_name].hours += entry.total_hours;
        employeeData[entry.employee_name].amount += entry.total_card_amount_flat;
      });
      
      return {
        monthlyData: Object.values(monthlyData),
        employeeData: Object.values(employeeData).slice(0, 5) // Top 5 employees
      };
    }
  });

  const chartConfig = {
    hours: { label: 'Hours', color: '#3b82f6' },
    amount: { label: 'Amount (LE)', color: '#10b981' },
    shifts: { label: 'Shifts', color: '#f59e0b' }
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
          <CardTitle>Monthly Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData?.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData?.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Employees by Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData?.employeeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}h`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="hours"
                >
                  {chartData?.employeeData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData?.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="shifts" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCharts;
