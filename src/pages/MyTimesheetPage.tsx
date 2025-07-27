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
  const [filterType, setFilterType] = useState<'month' | 'payPeriod'>('month');
  const [payPeriodType, setPayPeriodType] = useState<'current' | 'previous'>('current');

  // Calculate pay period dates (assuming pay period ends on 28th of each month)
  const getPayPeriodDates = (type: 'current' | 'previous') => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (type === 'current') {
      // Current pay period: previous month 29th to current month 28th
      const startDate = new Date(currentYear, currentMonth - 1, 29);
      const endDate = new Date(currentYear, currentMonth, 28);
      return { startDate, endDate };
    } else {
      // Previous pay period: 2 months ago 29th to previous month 28th
      const startDate = new Date(currentYear, currentMonth - 2, 29);
      const endDate = new Date(currentYear, currentMonth - 1, 28);
      return { startDate, endDate };
    }
  };

    const { data: timesheetData, isLoading } = useQuery({
    queryKey: ['my-timesheet', user?.username, selectedMonth, selectedYear, filterType, payPeriodType],
    queryFn: async () => {
      if (!user?.username) return null;
      
      let startDate: string, endDate: string;
      
      if (filterType === 'month') {
        // Month-based filtering
        startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        endDate = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`;
      } else {
        // Pay period filtering
        const { startDate: payStartDate, endDate: payEndDate } = getPayPeriodDates(payPeriodType);
        startDate = payStartDate.toISOString().split('T')[0];
        endDate = payEndDate.toISOString().split('T')[0];
      }
      
      // First, try to get the employee's full name from the employees table
      let employeeName = user.username;
      
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('full_name')
        .eq('staff_id', user.username)
        .maybeSingle();
      
      if (employeeData?.full_name) {
        employeeName = employeeData.full_name;
      } else {
        // If not found in employees table, try admin_users table
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('full_name')
          .eq('username', user.username)
          .maybeSingle();
        
        if (adminData?.full_name) {
          employeeName = adminData.full_name;
        }
      }
      
      console.log('Searching for timesheet data:', {
        username: user.username,
        employeeName: employeeName,
        dateRange: { startDate, endDate }
      });
      
      const query = supabase
        .from('timesheet_entries')
        .select('*')
        .or(`employee_name.eq.${user.username},employee_name.eq.${employeeName}`)
        .gte('clock_in_date', startDate)
        .order('clock_in_date', { ascending: false });
        
      if (filterType === 'month') {
        query.lt('clock_in_date', endDate);
      } else {
        query.lte('clock_in_date', endDate);
      }

      const { data, error } = await query;
      
      console.log('Timesheet query result:', { data, error });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.username
  });

  const { data: employeeWageData } = useQuery({
    queryKey: ['employee-wage-rates', user?.username],
    queryFn: async () => {
      if (!user?.username) return null;
      
      // Try to get wage rates from employees table first
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('morning_wage_rate, night_wage_rate, full_name')
        .eq('staff_id', user.username)
        .maybeSingle();

      if (empData) {
        return empData;
      }
      
      // If not found, get default wage rates from wage_settings
      const { data: wageSettings, error: wageError } = await supabase
        .from('wage_settings')
        .select('morning_wage_rate, night_wage_rate')
        .single();
      
      return {
        morning_wage_rate: wageSettings?.morning_wage_rate || 17,
        night_wage_rate: wageSettings?.night_wage_rate || 20,
        full_name: user.username
      };
    },
    enabled: !!user?.username
  });

  const totalHours = timesheetData?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
  const totalMorningHours = timesheetData?.reduce((sum, entry) => sum + (entry.morning_hours || 0), 0) || 0;
  const totalNightHours = timesheetData?.reduce((sum, entry) => sum + (entry.night_hours || 0), 0) || 0;
  
  const morningWageRate = employeeWageData?.morning_wage_rate || 17;
  const nightWageRate = employeeWageData?.night_wage_rate || 20;
  
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
    <div className="space-y-2 p-1 sm:p-4 border-l-4 border-l-blue-500 sm:border-l-0 min-h-screen sm:min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">My Timesheet</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">View your attendance and earnings summary</p>
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <Select value={filterType} onValueChange={(value: 'month' | 'payPeriod') => setFilterType(value)}>
            <SelectTrigger className="w-28 sm:w-40 h-8 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">By Month</SelectItem>
              <SelectItem value="payPeriod">Pay Period</SelectItem>
            </SelectContent>
          </Select>
          
          {filterType === 'month' && (
            <>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-24 sm:w-32 h-8 sm:h-10">
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
                <SelectTrigger className="w-16 sm:w-20 h-8 sm:h-10">
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
            </>
          )}
          
          {filterType === 'payPeriod' && (
            <Select value={payPeriodType} onValueChange={(value: 'current' | 'previous') => setPayPeriodType(value)}>
              <SelectTrigger className="w-36 sm:w-48 h-8 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Pay Period</SelectItem>
                <SelectItem value="previous">Previous Pay Period</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 sm:pb-2 px-2 sm:px-6 pt-2 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-2 sm:px-6 pb-2 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold">{formatHours(totalHours)}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              This period
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 sm:pb-2 px-2 sm:px-6 pt-2 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Morning Hours</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-2 sm:px-6 pb-2 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-blue-600">{formatHours(totalMorningHours)}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              LE {morningWageRate}/hour
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 sm:pb-2 px-2 sm:px-6 pt-2 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Night Hours</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-2 sm:px-6 pb-2 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-purple-600">{formatHours(totalNightHours)}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              LE {nightWageRate}/hour
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 sm:pb-2 px-2 sm:px-6 pt-2 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2 px-2 sm:px-6 pb-2 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-green-600">LE {totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              This period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timesheet Entries */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 sm:pb-4 px-2 sm:px-6 pt-2 sm:pt-6">
          <CardTitle className="text-base sm:text-xl">Timesheet Entries</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-2 px-2 sm:px-6 pb-2 sm:pb-6">
          {timesheetData && timesheetData.length > 0 ? (
            <div className="space-y-1 sm:space-y-3">
              {timesheetData.map((entry) => (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-1.5 sm:p-3 border rounded-md space-y-1 sm:space-y-0">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <span className="text-sm sm:text-base font-medium">{new Date(entry.clock_in_date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {entry.clock_in_time} - {entry.clock_out_time}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Badge variant="outline" className="text-xs">
                      {formatHours(entry.total_hours)}h
                    </Badge>
                    {entry.morning_hours > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        M: {formatHours(entry.morning_hours)}
                      </Badge>
                    )}
                    {entry.night_hours > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                        N: {formatHours(entry.night_hours)}
                      </Badge>
                    )}
                    <div className="text-xs sm:text-sm font-medium text-green-600">
                      LE {entry.total_card_amount_split || entry.total_card_amount_flat}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No timesheet entries found for the selected period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTimesheetPage;