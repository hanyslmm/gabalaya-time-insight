
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { Clock, TrendingUp } from 'lucide-react';

interface WeeklyData {
  date: string;
  hours: number;
  displayDay: string;
}

interface MonthlyHoursTrendProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

const MonthlyHoursTrend: React.FC<MonthlyHoursTrendProps> = ({ 
  timePeriod = 'current',
  dateRange 
}) => {
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['weekly-hours-trend', timePeriod, dateRange],
    queryFn: async () => {
      // Get current week starting from Saturday
      const today = new Date();
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 6 }); // Saturday = 6
      const currentWeekEnd = endOfWeek(today, { weekStartsOn: 6 }); // Friday = 5
      
      // Get all days in the current week (Saturday to Friday)
      const weekDays = eachDayOfInterval({
        start: currentWeekStart,
        end: currentWeekEnd
      });

      let query = supabase
        .from('timesheet_entries')
        .select('clock_in_date, total_hours');
      
      // Query for current week data
      query = query
        .gte('clock_in_date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(currentWeekEnd, 'yyyy-MM-dd'));

      const { data: timesheets, error } = await query;

      if (error) throw error;

      // Initialize all days with 0 hours
      const dailyStats: Record<string, WeeklyData> = {};
      
      weekDays.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyStats[dateKey] = {
          date: dateKey,
          displayDay: format(date, 'EEE'), // Sat, Sun, Mon, etc.
          hours: 0
        };
      });

      // Aggregate hours by date
      timesheets?.forEach(entry => {
        const dateKey = entry.clock_in_date;
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].hours += entry.total_hours || 0;
        }
      });

      // Return days in order: Saturday to Friday
      return weekDays.map(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return dailyStats[dateKey];
      });
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
            Hours Trend - Current Week
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

  const totalHours = weeklyData?.reduce((sum, day) => sum + day.hours, 0) || 0;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Hours Trend - Current Week
            </span>
          </CardTitle>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {Math.round(totalHours)}h
            </div>
            <p className="text-xs text-muted-foreground">Total (Sat-Fri)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="displayDay" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tick={{ fontSize: 12 }}
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
