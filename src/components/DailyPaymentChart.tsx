
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { DollarSign, TrendingUp } from 'lucide-react';

interface DailyData {
  date: string;
  amount: number;
  displayDate: string;
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
  const { data: dailyData, isLoading } = useQuery({
    queryKey: ['daily-payment-chart', timePeriod, dateRange],
    queryFn: async () => {
      // Default to current week (last 7 days) if no date range provided
      const today = new Date();
      const defaultRange = {
        from: subDays(today, 6), // Last 7 days including today
        to: today
      };
      
      const effectiveRange = dateRange || defaultRange;
      
      let query = supabase
        .from('timesheet_entries')
        .select('clock_in_date, total_card_amount_flat');
      
      query = query
        .gte('clock_in_date', format(effectiveRange.from, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(effectiveRange.to, 'yyyy-MM-dd'));

      const { data: timesheets, error } = await query;

      if (error) throw error;

      // Get all dates in range - fix the interval type issue
      const dates = eachDayOfInterval({
        start: effectiveRange.from,
        end: effectiveRange.to
      });
      const dailyStats: Record<string, DailyData> = {};
      
      // Initialize all dates with 0 and show weekday names
      dates.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyStats[dateKey] = {
          date: dateKey,
          displayDate: format(date, 'EEE'), // Show weekday (Sat, Sun, Mon, etc.)
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

      return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
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
            Daily Payment Analysis
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

  const totalAmount = dailyData?.reduce((sum, day) => sum + day.amount, 0) || 0;
  const avgDaily = dailyData?.length ? totalAmount / dailyData.length : 0;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-warning/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-warning/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <span className="bg-gradient-to-r from-warning to-accent bg-clip-text text-transparent">
              Daily Payment Analysis
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
            <LineChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="displayDate" 
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
                tickFormatter={(value) => `${Math.round(value)} LE`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: 'hsl(var(--warning))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="hsl(var(--warning))" 
                strokeWidth={3}
                dot={{ r: 4, fill: 'hsl(var(--warning))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                activeDot={{ r: 6, fill: 'hsl(var(--warning))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DailyPaymentChart;
