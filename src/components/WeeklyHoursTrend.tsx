import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Clock, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface WeeklyData {
  date: string;
  hours: number;
  displayDay: string;
  fullDayName: string;
}

interface WeeklyHoursTrendProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

const WeeklyHoursTrend: React.FC<WeeklyHoursTrendProps> = ({ 
  timePeriod = 'current',
  dateRange 
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['weekly-hours-trend', timePeriod, dateRange, weekOffset],
    queryFn: async () => {
      // Get the last 7 days from today with offset
      const today = new Date();
      const endDate = subDays(today, weekOffset * 7);
      const startDate = subDays(endDate, 6); // Get 7 days including endDate
      
      // Get all days in the 7-day period
      const weekDays = eachDayOfInterval({
        start: startDate,
        end: endDate
      });

      let query = supabase
        .from('timesheet_entries')
        .select('clock_in_date, total_hours');
      
      // Query for the 7-day period
      query = query
        .gte('clock_in_date', format(startDate, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(endDate, 'yyyy-MM-dd'));

      const { data: timesheets, error } = await query;

      if (error) throw error;

      // Initialize all days with 0 hours
      const dailyStats: Record<string, WeeklyData> = {};
      
      weekDays.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyStats[dateKey] = {
          date: dateKey,
          displayDay: format(date, 'EEEE'), // Full day name: Saturday, Sunday, Monday, etc.
          fullDayName: format(date, 'EEEE'),
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

      // Return days in chronological order
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
            Weekly Hours Trend
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
  
  // Get date range for display
  const getDateRangeLabel = () => {
    if (!weeklyData || weeklyData.length === 0) return '';
    const startDate = weeklyData[0].date;
    const endDate = weeklyData[weeklyData.length - 1].date;
    return `${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd')}`;
  };
  
  const getWeekLabel = () => {
    if (weekOffset === 0) return 'Last 7 Days';
    if (weekOffset === 1) return 'Previous 7 Days';
    return `${weekOffset * 7} days ago`;
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Weekly Hours Trend
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="h-8 w-8 p-0 hover:bg-primary/10"
              title="Previous 7 days"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[120px]">
              <div className="text-sm font-medium text-foreground">
                {getWeekLabel()}
              </div>
              <div className="text-xs text-muted-foreground">
                {getDateRangeLabel()}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              disabled={weekOffset <= 0}
              className="h-8 w-8 p-0 hover:bg-primary/10"
              title="Next 7 days"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary">
            {Math.round(totalHours)}h
          </div>
          <p className="text-xs text-muted-foreground">Total Hours</p>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
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
                fontSize={11}
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
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

export default WeeklyHoursTrend;