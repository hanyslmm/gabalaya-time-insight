import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { Clock, TrendingUp } from 'lucide-react';

interface MonthlyData {
  month: string;
  hours: number;
  displayMonth: string;
}

const MonthlyHoursTrend: React.FC = () => {
  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['monthly-hours-trend'],
    queryFn: async () => {
      // Get data for the last 6 months
      const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), i);
        return {
          key: format(date, 'yyyy-MM'),
          display: format(date, 'MMM yyyy')
        };
      }).reverse();

      const { data: timesheets, error } = await supabase
        .from('timesheet_entries')
        .select('clock_in_date, total_hours')
        .gte('clock_in_date', months[0].key + '-01');

      if (error) throw error;

      // Process data by month
      const monthlyStats: Record<string, MonthlyData> = {};
      
      months.forEach(({ key, display }) => {
        monthlyStats[key] = {
          month: key,
          displayMonth: display,
          hours: 0
        };
      });

      timesheets?.forEach(entry => {
        const monthKey = entry.clock_in_date.substring(0, 7); // Get YYYY-MM
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].hours += entry.total_hours || 0;
        }
      });

      return Object.values(monthlyStats);
    }
  });

  const chartConfig = {
    hours: { label: 'Hours', color: 'hsl(var(--primary))' }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/20">
          <CardTitle className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            Monthly Hours Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-64 bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalHours = monthlyData?.reduce((sum, month) => sum + month.hours, 0) || 0;
  const avgMonthlyHours = monthlyData?.length ? totalHours / monthlyData.length : 0;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Monthly Hours Trend
            </span>
          </CardTitle>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {Math.round(totalHours)}h
            </div>
            <p className="text-xs text-muted-foreground">Total (6 months)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="displayMonth" 
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
  );
};

export default MonthlyHoursTrend;