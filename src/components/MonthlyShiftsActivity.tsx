
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { Activity, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MonthlyShiftsData {
  month: string;
  shifts: number;
  displayMonth: string;
}

interface MonthlyShiftsActivityProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

const MonthlyShiftsActivity: React.FC<MonthlyShiftsActivityProps> = ({ 
  timePeriod = 'current',
  dateRange 
}) => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['monthly-shifts-activity', timePeriod, dateRange, activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      // Get data for the last 6 months or use provided date range
      const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), i);
        return {
          key: format(date, 'yyyy-MM'),
          display: format(date, 'MMM yyyy')
        };
      }).reverse();

      let query = supabase.from('timesheet_entries').select('clock_in_date');
      
      if (activeOrganizationId) {
        query = query.eq('organization_id', activeOrganizationId);
      }
      
      if (dateRange && timePeriod !== 'alltime') {
        query = query
          .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('clock_in_date', format(dateRange.to, 'yyyy-MM-dd'));
      } else {
        // Default to last 6 months
        query = query.gte('clock_in_date', months[0].key + '-01');
      }

      const { data: timesheets, error } = await query;

      if (error) throw error;

      // Process data by month
      const monthlyStats: Record<string, MonthlyShiftsData> = {};
      
      months.forEach(({ key, display }) => {
        monthlyStats[key] = {
          month: key,
          displayMonth: display,
          shifts: 0
        };
      });

      timesheets?.forEach(entry => {
        const monthKey = entry.clock_in_date.substring(0, 7); // Get YYYY-MM
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].shifts += 1;
        }
      });

      return Object.values(monthlyStats);
    }
  });

  const chartConfig = {
    shifts: { label: 'Shifts', color: 'hsl(var(--accent))' }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/20">
          <CardTitle className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-accent" />
            Monthly Shifts Activity
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

  const totalShifts = shiftsData?.reduce((sum, month) => sum + month.shifts, 0) || 0;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Activity className="h-5 w-5 text-accent" />
            </div>
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Monthly Shifts Activity
            </span>
          </CardTitle>
          <div className="text-right">
            <div className="text-lg font-bold text-accent">
              {Math.round(totalShifts)}
            </div>
            <p className="text-xs text-muted-foreground">Total shifts (6mo)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={shiftsData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="colorShifts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
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
                cursor={{ fill: 'hsl(var(--accent) / 0.1)' }}
              />
              <Bar 
                dataKey="shifts" 
                fill="url(#colorShifts)" 
                radius={[6, 6, 0, 0]}
                stroke="hsl(var(--accent))"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default MonthlyShiftsActivity;
