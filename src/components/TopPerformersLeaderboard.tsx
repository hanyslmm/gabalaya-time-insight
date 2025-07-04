import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, Clock, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface EmployeePerformance {
  name: string;
  hours: number;
  amount: number;
  shifts: number;
}

const TopPerformersLeaderboard: React.FC = () => {
  const { data: topPerformers, isLoading } = useQuery({
    queryKey: ['top-performers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('employee_name, total_hours, total_card_amount_flat')
        .gte('clock_in_date', format(subDays(new Date(), 30), 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Group by employee and calculate totals
      const employeeData: Record<string, EmployeePerformance> = {};
      
      data?.forEach(entry => {
        if (!employeeData[entry.employee_name]) {
          employeeData[entry.employee_name] = {
            name: entry.employee_name,
            hours: 0,
            amount: 0,
            shifts: 0
          };
        }
        employeeData[entry.employee_name].hours += entry.total_hours || 0;
        employeeData[entry.employee_name].amount += entry.total_card_amount_flat || 0;
        employeeData[entry.employee_name].shifts += 1;
      });
      
      // Sort by hours and return top 10
      return Object.values(employeeData)
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10);
    }
  });

  const getPositionIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <Star className="h-4 w-4 text-primary" />;
    }
  };

  const getPositionBadge = (index: number) => {
    switch (index) {
      case 0: return <Badge className="bg-yellow-500 text-white font-bold">1st</Badge>;
      case 1: return <Badge className="bg-gray-400 text-white font-bold">2nd</Badge>;
      case 2: return <Badge className="bg-amber-600 text-white font-bold">3rd</Badge>;
      default: return <Badge variant="outline" className="font-medium">{index + 1}th</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/20">
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-accent" />
            Top Performers Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted/40 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted/40 rounded w-24" />
                    <div className="h-3 bg-muted/30 rounded w-16" />
                  </div>
                </div>
                <div className="h-6 bg-muted/40 rounded w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-border/20">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Trophy className="h-5 w-5 text-accent" />
          </div>
          <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Top Performers Leaderboard
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {topPerformers?.map((performer, index) => (
            <div
              key={performer.name}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                index < 3 
                  ? 'bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20 hover:border-primary/40' 
                  : 'bg-muted/10 border-border/30 hover:border-border/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getPositionIcon(index)}
                  {getPositionBadge(index)}
                </div>
                
                <div className="space-y-1">
                  <div className="font-semibold text-foreground text-sm">
                    {performer.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {performer.shifts} shifts
                  </div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 text-sm font-bold text-primary">
                  <Clock className="h-3 w-3" />
                  {performer.hours.toFixed(1)}h
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  LE {Math.round(performer.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!topPerformers || topPerformers.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No performance data available yet</p>
            <p className="text-xs mt-1">Data will appear once timesheets are added</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopPerformersLeaderboard;