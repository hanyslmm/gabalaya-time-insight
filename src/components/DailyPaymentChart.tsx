
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { DollarSign, TrendingUp } from 'lucide-react';

interface WeeklyData {
  date: string;
  amount: number;
  displayDay: string;
}

interface DailyPaymentChartProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

const DailyPaymentChart: React.FC<DailyPaymentChartProps> = ({ 
  timePeriod = 'current',
  dateRange 
}) => {
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['weekly-payment-chart', timePeriod, dateRange],
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
        .select('clock_in_date, total_card_amount_flat');
      
      // Query for current week data
      query = query
        .gte('clock_in_date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(currentWeekEnd, 'yyyy-MM-dd'));

      const { data: timesheets, error } = await query;

      if (error) throw error;

      // Initialize all days with 0 amount
      const dailyStats: Record<string, WeeklyData> = {};
      
      weekDays.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyStats[dateKey] = {
          date: dateKey,
          displayDay: format(date, 'EEE'), // Sat, Sun, Mon, etc.
          amount: 0
        };
      });

      // Aggregate payments by date
      timesheets?.forEach(entry => {
        const dateKey = entry.clock_in_date;
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].amount += entry.total_card_amount_flat || 0;
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
    amount: { label: 'Payment (LE)', color: 'hsl(var(--warning))' }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card via-card to-warning/5 border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/20">
          <CardTitle className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-warning" />
            Revenue Analysis - Current Week
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

  const totalAmount = weeklyData?.reduce((sum, day) => sum + day.amount, 0) || 0;
  const avgDaily = weeklyData?.length ? totalAmount / weeklyData.length : 0;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-warning/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-warning/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <span className="bg-gradient-to-r from-warning to-accent bg-clip-text text-transparent">
              Revenue Analysis - Current Week
            </span>
          </CardTitle>
          <div className="text-right">
            <div className="text-lg font-bold text-warning">
              {Math.round(totalAmount)} LE
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(avgDaily)} LE daily avg
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.8}/>
                  <stop offset="50%" stopColor="hsl(var(--warning))" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.2}/>
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
                tickFormatter={(value) => `${Math.round(value)} LE`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ fill: 'hsl(var(--warning))', fillOpacity: 0.1 }}
              />
              <Bar 
                dataKey="amount" 
                fill="url(#colorRevenue)"
                stroke="hsl(var(--warning))"
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DailyPaymentChart;
