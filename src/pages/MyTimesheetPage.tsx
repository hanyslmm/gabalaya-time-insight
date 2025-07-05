
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Calendar, User, MessageCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  
  const currentMonth = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  };

  // Fetch employee timesheet data
  const { data: timesheetData, isLoading } = useQuery({
    queryKey: ['my-timesheet', user?.username],
    queryFn: async () => {
      if (!user?.username) return null;

      const { data: timesheets, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('employee_name', user.username)
        .gte('clock_in_date', format(currentMonth.from, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(currentMonth.to, 'yyyy-MM-dd'))
        .order('clock_in_date', { ascending: false });

      if (error) throw error;

      const totalHours = timesheets?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
      const totalEarnings = timesheets?.reduce((sum, entry) => sum + (entry.total_card_amount_flat || 0), 0) || 0;

      return {
        entries: timesheets || [],
        totalHours,
        totalEarnings
      };
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

      if (error && error.code !== 'PGRST116') throw error;
      return data?.motivational_message || "Keep up the great work! Your dedication and effort make a real difference to our team.";
    }
  });

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">My Timesheet</h1>
          <p className="mt-2 text-muted-foreground">Your work summary and time entries</p>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted/20 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">My Timesheet</h1>
        <p className="mt-2 text-muted-foreground">Your work summary for {format(new Date(), 'MMMM yyyy')}</p>
      </div>

      {/* Motivational Message */}
      <Card className="mb-8 bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-primary/20 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Message from Management</h3>
              <p className="text-muted-foreground italic text-lg leading-relaxed">
                "{motivationalMessage}"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-a-Glance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Hours Worked</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{Math.round(timesheetData?.totalHours || 0)}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              This pay period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Estimated Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{Math.round(timesheetData?.totalEarnings || 0)} LE</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on current rates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Time Card View */}
      <Card className="bg-gradient-to-br from-card via-card to-muted/5 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            Time Card Entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {timesheetData?.entries && timesheetData.entries.length > 0 ? (
            <div className="space-y-4">
              {timesheetData.entries.map((entry) => (
                <Card key={entry.id} className="border border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {format(new Date(entry.clock_in_date), 'EEEE, MMMM d, yyyy')}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>Clock In: {entry.clock_in_time}</span>
                            <span>•</span>
                            <span>Clock Out: {entry.clock_out_time}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="font-medium">
                          {Math.round(entry.total_hours || 0)} hours
                        </Badge>
                        <div className="text-right">
                          <div className="font-bold text-success">
                            {Math.round(entry.total_card_amount_flat || 0)} LE
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Earnings
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {entry.employee_note && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Note:</span> {entry.employee_note}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Time Entries</h3>
              <p className="text-muted-foreground">
                No timesheet entries found for this pay period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTimesheetPage;
