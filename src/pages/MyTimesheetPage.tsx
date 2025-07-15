
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Calendar, Quote } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface TimesheetEntry {
  id: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_time: string;
  total_hours: number;
  total_card_amount_flat: number;
}

const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();

  // Fetch employee's timesheet entries
  const { data: timesheetEntries, isLoading: timesheetsLoading } = useQuery({
    queryKey: ['my-timesheet', user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('employee_name', user.username)
        .order('clock_in_date', { ascending: false });

      if (error) throw error;
      return data as TimesheetEntry[];
    },
    enabled: !!user?.username
  });

  // Fetch motivational message
  const { data: motivationalMessage } = useQuery({
    queryKey: ['motivational-message'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('motivational_message')
        .single();

      return data?.motivational_message || "Keep up the great work! Your dedication and effort make a real difference to our team.";
    }
  });

  // Calculate current pay period stats (current month)
  const currentPayPeriodStats = React.useMemo(() => {
    if (!timesheetEntries) return { totalHours: 0, estimatedEarnings: 0 };

    const currentMonth = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const currentPeriodEntries = timesheetEntries.filter(entry => {
      const entryDate = parseISO(entry.clock_in_date);
      return isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
    });

    const totalHours = currentPeriodEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
    const estimatedEarnings = currentPeriodEntries.reduce((sum, entry) => sum + (entry.total_card_amount_flat || 0), 0);

    return { totalHours, estimatedEarnings };
  }, [timesheetEntries]);

  if (timesheetsLoading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">My Timesheet</h1>
          <p className="mt-2 text-muted-foreground">View your work hours and contributions</p>
        </div>
        
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-32 bg-muted/20 rounded-lg"></div>
            <div className="h-32 bg-muted/20 rounded-lg"></div>
          </div>
          <div className="h-64 bg-muted/20 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">My Timesheet</h1>
        <p className="mt-2 text-muted-foreground">Welcome back, {user?.full_name || user?.username}!</p>
      </div>

      {/* Motivational Message */}
      {motivationalMessage && (
        <Card className="mb-8 bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <Quote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground italic">
                  "{motivationalMessage}"
                </p>
                <p className="text-sm text-muted-foreground mt-2">— Management Team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-a-Glance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours (This Month)</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {Math.round(currentPayPeriodStats.totalHours)}h
            </div>
            <p className="text-xs text-muted-foreground">Current pay period</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-warning/5 border-border/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {Math.round(currentPayPeriodStats.estimatedEarnings)} LE
            </div>
            <p className="text-xs text-muted-foreground">Current pay period</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Time Card View */}
      <Card className="bg-gradient-to-br from-card via-card to-muted/5 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Calendar className="h-5 w-5 text-accent" />
            </div>
            Recent Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timesheetEntries && timesheetEntries.length > 0 ? (
            <div className="space-y-4">
              {timesheetEntries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/20 to-muted/5 rounded-lg border border-border/30 hover:border-border/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-foreground">
                        {format(parseISO(entry.clock_in_date), 'MMM')}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {format(parseISO(entry.clock_in_date), 'dd')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {format(parseISO(entry.clock_in_date), 'EEEE, MMMM dd, yyyy')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.clock_in_time} - {entry.clock_out_time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">
                      {Math.round(entry.total_hours || 0)}h
                    </Badge>
                    <div className="text-sm text-warning font-semibold">
                      {Math.round(entry.total_card_amount_flat || 0)} LE
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No timesheet entries found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your work hours will appear here once you start logging time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTimesheetPage;
