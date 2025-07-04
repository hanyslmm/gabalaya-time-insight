import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import InteractiveChart from './InteractiveChart';

interface DailyData {
  date: string;
  amount: number;
  hours: number;
  shifts: number;
}

const DailyPaymentChart: React.FC = () => {
  const { data: dailyData, isLoading } = useQuery({
    queryKey: ['daily-payment-chart'],
    queryFn: async () => {
      // Get last 7 days of data
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return format(date, 'yyyy-MM-dd');
      }).reverse();

      const { data: timesheets, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .in('clock_in_date', days);

      if (error) throw error;

      // Process data by day
      const dailyStats: Record<string, DailyData> = {};
      
      days.forEach(day => {
        dailyStats[day] = {
          date: format(new Date(day), 'MMM dd'),
          amount: 0,
          hours: 0,
          shifts: 0
        };
      });

      timesheets?.forEach(entry => {
        const day = entry.clock_in_date;
        if (dailyStats[day]) {
          dailyStats[day].amount += entry.total_card_amount_flat || 0;
          dailyStats[day].hours += entry.total_hours || 0;
          dailyStats[day].shifts += 1;
        }
      });

      const chartData = Object.values(dailyStats);
      
      // Calculate trend
      const lastTwoDays = chartData.slice(-2);
      const trend = lastTwoDays.length === 2 
        ? lastTwoDays[1].amount - lastTwoDays[0].amount 
        : 0;

      return { chartData, trend };
    }
  });

  const chartConfig = {
    amount: { label: 'Payment (LE)', color: 'hsl(var(--chart-2))' }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalWeekPayment = dailyData?.chartData.reduce((sum, day) => sum + day.amount, 0) || 0;
  const trend = dailyData?.trend || 0;

  return (
    <InteractiveChart title="Daily Payments (Last 7 Days)">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Daily Payments (Last 7 Days)
            </div>
            <div className="flex items-center gap-2 text-sm">
              {trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {trend >= 0 ? '+' : ''}{trend.toFixed(0)} LE
              </span>
            </div>
          </CardTitle>
          <div className="text-2xl font-bold text-green-600">
            {totalWeekPayment.toFixed(0)} LE
          </div>
          <p className="text-sm text-muted-foreground">Total this week</p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData?.chartData}>
                <defs>
                  <linearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value, name) => [
                    `${value} LE`,
                    'Payment'
                  ]}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#paymentGradient)" 
                  radius={[4, 4, 0, 0]}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </InteractiveChart>
  );
};

export default DailyPaymentChart;
