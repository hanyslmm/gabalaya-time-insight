import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';
// Simple format function for hours display
const formatHours = (hours: number) => hours.toFixed(2);

const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: timesheetData, isLoading } = useQuery({
    queryKey: ['my-timesheet', user?.username, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!user?.username) return null;
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('employee_name', user.username)
        .gte('clock_in_date', `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`)
        .lt('clock_in_date', `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`)
        .order('clock_in_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.username
  });

  const { data: employeeData } = useQuery({
    queryKey: ['employee-wage-rates', user?.username],
    queryFn: async () => {
      if (!user?.username) return null;
      
      const { data, error } = await supabase
        .from('employees')
        .select('morning_wage_rate, night_wage_rate, full_name')
        .eq('staff_id', user.username)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.username
  });

  const totalHours = timesheetData?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
  const totalMorningHours = timesheetData?.reduce((sum, entry) => sum + (entry.morning_hours || 0), 0) || 0;
  const totalNightHours = timesheetData?.reduce((sum, entry) => sum + (entry.night_hours || 0), 0) || 0;
  
  const morningWageRate = employeeData?.morning_wage_rate || 17;
  const nightWageRate = employeeData?.night_wage_rate || 20;
  
  const totalEarnings = (totalMorningHours * morningWageRate) + (totalNightHours * nightWageRate);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Timesheet</h1>
          <p className="text-muted-foreground">View your attendance and earnings summary</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              This period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Morning Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatHours(totalMorningHours)}</div>
            <p className="text-xs text-muted-foreground">
              LE {morningWageRate}/hour
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatHours(totalNightHours)}</div>
            <p className="text-xs text-muted-foreground">
              LE {nightWageRate}/hour
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">LE {totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              This period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timesheet Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timesheetData && timesheetData.length > 0 ? (
            <div className="space-y-4">
              {timesheetData.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{new Date(entry.clock_in_date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.clock_in_time} - {entry.clock_out_time}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">
                      {formatHours(entry.total_hours)} hours
                    </Badge>
                    {entry.morning_hours > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Morning: {formatHours(entry.morning_hours)}
                      </Badge>
                    )}
                    {entry.night_hours > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        Night: {formatHours(entry.night_hours)}
                      </Badge>
                    )}
                    <div className="text-sm font-medium text-green-600">
                      LE {entry.total_card_amount_split || entry.total_card_amount_flat}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No timesheet entries found for the selected period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTimesheetPage;