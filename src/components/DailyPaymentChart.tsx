
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subWeeks } from 'date-fns';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import InteractiveChart from './InteractiveChart';

interface DailyData {
  date: string;
  amount: number;
  hours: number;
  shifts: number;
  displayDate: string;
}

const DailyPaymentChart: React.FC = () => {
  const [period, setPeriod] = useState('7days');

  const getPeriodConfig = () => {
    const now = new Date();
    switch (period) {
      case '7days':
        return { days: 7, label: 'Last 7 Days' };
      case '14days':
        return { days: 14, label: 'Last 2 Weeks' };
      case '30days':
        return { days: 30, label: 'Last 30 Days' };
      default:
        return { days: 7, label: 'Last 7 Days' };
    }
  };

  const config = getPeriodConfig();

  const { data: dailyData, isLoading } = useQuery({
    queryKey: ['daily-payment-chart', period],
    queryFn: async () => {
      // Get data for the selected period
      const days = Array.from({ length: config.days }, (_, i) => {
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
        const dateObj = new Date(day);
        dailyStats[day] = {
          date: day,
          displayDate: format(dateObj, config.days <= 7 ? 'EEE' : 'MMM dd'),
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
      const lastTwoPeriods = chartData.slice(-Math.min(2, chartData.length));
      const trend = lastTwoPeriods.length === 2 
        ? lastTwoPeriods[1].amount - lastTwoPeriods[0].amount 
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
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPayment = dailyData?.chartData.reduce((sum, day) => sum + day.amount, 0) || 0;
  const trend = dailyData?.trend || 0;
  const avgDaily = dailyData?.chartData.length ? totalPayment / dailyData.chartData.length : 0;

  return (
    <InteractiveChart title={`Daily Payments - ${config.label}`}>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <CardTitle>Daily Payments</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                {trend >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {trend >= 0 ? '+' : ''}{Math.round(trend)} LE
                </span>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="7days">7 Days</SelectItem>
                  <SelectItem value="14days">14 Days</SelectItem>
                  <SelectItem value="30days">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(totalPayment)} LE
              </div>
              <p className="text-sm text-muted-foreground">Total {config.label.toLowerCase()}</p>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">
                {Math.round(avgDaily)} LE
              </div>
              <p className="text-sm text-muted-foreground">Daily average</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData?.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tick={{ fontSize: 11 }}
                  angle={config.days > 14 ? -45 : 0}
                  textAnchor={config.days > 14 ? "end" : "middle"}
                  height={40}
                  interval={0}
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
