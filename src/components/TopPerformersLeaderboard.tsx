
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface TopPerformersProps {
  timePeriod?: string;
  dateRange?: {
    from: Date;
    to: Date;
    label: string;
  };
}

interface EmployeePerformance {
  name: string;
  hours: number;
  amount: number;
  shifts: number;
  avgHours: number;
}

const TopPerformersLeaderboard: React.FC<TopPerformersProps> = ({ 
  timePeriod = 'current',
  dateRange 
}) => {
  const { data: topPerformers, isLoading } = useQuery({
    queryKey: ['top-performers', timePeriod, dateRange],
    queryFn: async () => {
      let query = supabase.from('timesheet_entries').select('employee_name, total_hours, total_card_amount_flat, employees(full_name)');
      
      if (dateRange) {
        query = query
          .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('clock_in_date', format(dateRange.to, 'yyyy-MM-dd'));
      }
      
      const { data: timesheets, error } = await query;
      
      if (error) throw error;

      // Aggregate data by employee
      const employeeStats: Record<string, EmployeePerformance> = {};
      
      timesheets?.forEach(entry => {
        const displayName = entry.employees?.full_name || entry.employee_name;
        if (!employeeStats[displayName]) {
          employeeStats[displayName] = {
            name: displayName,
            hours: 0,
            amount: 0,
            shifts: 0,
            avgHours: 0
          };
        }
        
        employeeStats[displayName].hours += entry.total_hours || 0;
        employeeStats[displayName].amount += entry.total_card_amount_flat || 0;
        employeeStats[displayName].shifts += 1;
      });

      // Calculate averages and sort by total hours
      const performers = Object.values(employeeStats)
        .map(emp => ({
          ...emp,
          avgHours: emp.shifts > 0 ? emp.hours / emp.shifts : 0
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      return performers;
    }
  });

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
      <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/20">
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 bg-muted/20 rounded-lg">
                <div className="h-12 w-12 bg-muted/40 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted/40 rounded w-3/4"></div>
                  <div className="h-3 bg-muted/30 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/30 shadow-card hover:shadow-elegant transition-all duration-300 rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border/20 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-xl shadow-lg">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">
              Top Performers
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">{dateRange?.label || 'Current Period'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3 sm:space-y-4">
          {topPerformers?.map((performer, index) => (
            <div
              key={performer.name}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-background/80 via-background/60 to-primary/5 border border-border/30 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getLeaderIcon(index)}
                  {getLeaderBadge(index)}
                </div>
                <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                    {performer.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <span className="whitespace-nowrap">{Math.round(performer.hours)} hours</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">{performer.shifts} shifts</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">{Math.round(performer.avgHours)} avg</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 sm:ml-4">
                <div className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {Math.round(performer.amount)} LE
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  Total earnings
                </div>
              </div>
            </div>
          ))}
          
          {(!topPerformers || topPerformers.length === 0) && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <div className="p-4 bg-muted/20 rounded-full w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 flex items-center justify-center">
                <Trophy className="h-10 w-10 sm:h-12 sm:w-12 opacity-50" />
              </div>
              <p className="text-sm sm:text-base font-medium">No performance data available for the selected period.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPerformersLeaderboard;
