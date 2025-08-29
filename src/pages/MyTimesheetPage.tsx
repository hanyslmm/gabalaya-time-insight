import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import MobilePageWrapper, { MobileSection, MobileCard, MobileHeader } from '@/components/MobilePageWrapper';
import { getCompanyTimezone } from '@/utils/timezoneUtils';
// Simple format function for hours display
const formatHours = (hours: number) => hours.toFixed(2);

const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState<'month' | 'payPeriod'>('month');
  const [payPeriodType, setPayPeriodType] = useState<'current' | 'previous'>('current');

  // Company timezone for consistent display
  const [companyTimezone, setCompanyTimezone] = useState<string>('Africa/Cairo');

  useEffect(() => {
    let isMounted = true;
    
    const fetchTimezone = async () => {
      try {
        const tz = await getCompanyTimezone();
        if (isMounted) setCompanyTimezone(tz);
      } catch (error) {
        console.warn('Failed to fetch timezone:', error);
      }
    };
    
    fetchTimezone();
    return () => { isMounted = false; };
  }, []);

  const formatCompanyDate = (dateStr: string) => {
    try {
      const date = new Date(`${dateStr}T00:00:00Z`);
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: companyTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return new Date(dateStr).toLocaleDateString();
    }
  };

  const formatCompanyTimeAMPM = (dateStr?: string, timeStr?: string | null) => {
    if (!dateStr || !timeStr) return '—';
    const timeClean = (timeStr || '').split('.')[0] || '00:00:00';
    const date = new Date(`${dateStr}T${timeClean}Z`);
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: companyTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return timeClean;
    }
  };
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

  const { data: wageSettings } = useQuery({
    queryKey: ['wage-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wage_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const totalHours = timesheetData?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
  
  // Calculate morning and night hours with fallback calculation
  const totalMorningHours = timesheetData?.reduce((sum, entry) => {
    if (entry.morning_hours > 0) {
      return sum + entry.morning_hours;
    }
    // Fallback: calculate from time periods if wage settings available
    if (wageSettings && entry.clock_in_time && entry.clock_out_time) {
      const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
      const clockOutDateTime = entry.clock_out_date 
        ? new Date(`${entry.clock_out_date}T${entry.clock_out_time}`)
        : new Date(`${entry.clock_in_date}T${entry.clock_out_time}`);
        
      // Handle next day scenario
      if (clockOutDateTime < clockInDateTime) {
        clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
      }

      const baseDate = new Date(entry.clock_in_date);
      const morningStart = new Date(baseDate);
      const [morningStartHour, morningStartMin] = wageSettings.morning_start_time.split(':');
      morningStart.setHours(parseInt(morningStartHour), parseInt(morningStartMin), 0, 0);
      
      const morningEnd = new Date(baseDate);
      const [morningEndHour, morningEndMin] = wageSettings.morning_end_time.split(':');
      morningEnd.setHours(parseInt(morningEndHour), parseInt(morningEndMin), 0, 0);
      
      const morningOverlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
      const morningOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
      
      if (morningOverlapEnd > morningOverlapStart) {
        const morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
        return sum + morningHours;
      }
    }
    return sum;
  }, 0) || 0;
  
  const totalNightHours = timesheetData?.reduce((sum, entry) => {
    if (entry.night_hours > 0) {
      return sum + entry.night_hours;
    }
    // Fallback: calculate from time periods if wage settings available
    if (wageSettings && entry.clock_in_time && entry.clock_out_time) {
      const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
      const clockOutDateTime = entry.clock_out_date 
        ? new Date(`${entry.clock_out_date}T${entry.clock_out_time}`)
        : new Date(`${entry.clock_in_date}T${entry.clock_out_time}`);
        
      // Handle next day scenario
      if (clockOutDateTime < clockInDateTime) {
        clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
      }

      const baseDate = new Date(entry.clock_in_date);
      const nightStart = new Date(baseDate);
      const [nightStartHour, nightStartMin] = wageSettings.night_start_time.split(':');
      nightStart.setHours(parseInt(nightStartHour), parseInt(nightStartMin), 0, 0);
      
      const nightEnd = new Date(baseDate);
      const [nightEndHour, nightEndMin] = wageSettings.night_end_time.split(':');
      nightEnd.setHours(parseInt(nightEndHour), parseInt(nightEndMin), 0, 0);
      
      // Handle next day for night end time if it's earlier than night start
      if (nightEnd <= nightStart) {
        nightEnd.setDate(nightEnd.getDate() + 1);
      }
      
      const nightOverlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
      const nightOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
      
      if (nightOverlapEnd > nightOverlapStart) {
        const nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
        return sum + nightHours;
      }
    }
    return sum;
  }, 0) || 0;
  
  const morningWageRate = employeeWageData?.morning_wage_rate || 17;
  const nightWageRate = employeeWageData?.night_wage_rate || 20;
  
  // Calculate earnings: use stored amounts if available, otherwise calculate from hours
  const totalEarnings = timesheetData?.reduce((sum, entry) => {
    const storedAmount = entry.total_card_amount_split || entry.total_card_amount_flat;
    if (storedAmount && storedAmount > 0) {
      return sum + storedAmount;
    }
    // Fallback: calculate from hours and wage rates if no stored amount
    const morningEarnings = (entry.morning_hours || 0) * morningWageRate;
    const nightEarnings = (entry.night_hours || 0) * nightWageRate;
    const totalHourlyEarnings = (entry.total_hours || 0) * morningWageRate; // Default rate for unspecified hours
    
    // Use split calculation if morning/night hours are specified, otherwise use total hours
    const calculatedAmount = (entry.morning_hours > 0 || entry.night_hours > 0) 
      ? morningEarnings + nightEarnings 
      : totalHourlyEarnings;
    
    return sum + calculatedAmount;
  }, 0) || 0;

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
    <MobilePageWrapper showMobileIndicator>
      <MobileHeader 
        title="My Timesheet" 
        subtitle="View your attendance and earnings summary"
        actions={
          <div className="flex flex-wrap gap-0.5 sm:gap-1">
            <Select value={filterType} onValueChange={(value: 'month' | 'payPeriod') => setFilterType(value)}>
              <SelectTrigger className="w-20 sm:w-32 h-7 sm:h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="payPeriod">Pay Period</SelectItem>
              </SelectContent>
            </Select>
            
            {filterType === 'month' && (
              <>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-16 sm:w-24 h-7 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label.slice(0, 3)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-14 sm:w-16 h-7 sm:h-9 text-xs sm:text-sm">
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
                <SelectTrigger className="w-20 sm:w-32 h-7 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="previous">Previous</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      <MobileSection spacing="tight">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0.5 sm:gap-2">
          {/* Total Hours */}
          <div className="bg-card border rounded p-1 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <span className="text-xs font-medium text-muted-foreground">Hours</span>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-sm sm:text-xl font-bold">{formatHours(totalHours)}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">Total</div>
          </div>

          {/* Morning Hours */}
          <div className="bg-card border rounded p-1 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <span className="text-xs font-medium text-muted-foreground">Morning</span>
              <TrendingUp className="h-3 w-3 text-blue-600" />
            </div>
            <div className="text-sm sm:text-xl font-bold text-blue-600">{formatHours(totalMorningHours)}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">LE {morningWageRate}/h</div>
          </div>

          {/* Night Hours */}
          <div className="bg-card border rounded p-1 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <span className="text-xs font-medium text-muted-foreground">Night</span>
              <TrendingUp className="h-3 w-3 text-purple-600" />
            </div>
            <div className="text-sm sm:text-xl font-bold text-purple-600">{formatHours(totalNightHours)}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">LE {nightWageRate}/h</div>
          </div>

          {/* Total Earnings */}
          <div className="bg-card border rounded p-1 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <span className="text-xs font-medium text-muted-foreground">Earnings</span>
              <DollarSign className="h-3 w-3 text-green-600" />
            </div>
            <div className="text-sm sm:text-xl font-bold text-green-600">LE {totalEarnings.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground hidden sm:block">Total</div>
          </div>
        </div>
      </MobileSection>

      <MobileSection>
        <MobileCard className="border">
          <div className="mb-1 sm:mb-2">
            <h3 className="text-sm sm:text-lg font-semibold">Timesheet Entries</h3>
          </div>
          {timesheetData && timesheetData.length > 0 ? (
            <div className="space-y-0.5 sm:space-y-2">
              {timesheetData.map((entry) => (
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-1 sm:p-2 border rounded text-xs sm:text-sm space-y-0.5 sm:space-y-0">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatCompanyDate(entry.clock_in_date)}</span>
                    <span className="text-muted-foreground">
                      {formatCompanyTimeAMPM(entry.clock_in_date, entry.clock_in_time)} - {entry.clock_out_time ? formatCompanyTimeAMPM(entry.clock_out_date || entry.clock_in_date, entry.clock_out_time) : '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                    <Badge variant="outline" className="text-xs h-4">
                      {formatHours(entry.total_hours)}h
                    </Badge>
                    {entry.morning_hours > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs h-4">
                        M:{formatHours(entry.morning_hours)}
                      </Badge>
                    )}
                    {entry.night_hours > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs h-4">
                        N:{formatHours(entry.night_hours)}
                      </Badge>
                    )}
                    <span className="text-xs font-medium text-green-600">
                      LE{(() => {
                        const storedAmount = entry.total_card_amount_split || entry.total_card_amount_flat;
                        if (storedAmount && storedAmount > 0) {
                          return storedAmount.toFixed(2);
                        }
                        // Fallback calculation
                        const morningEarnings = (entry.morning_hours || 0) * morningWageRate;
                        const nightEarnings = (entry.night_hours || 0) * nightWageRate;
                        const totalHourlyEarnings = (entry.total_hours || 0) * morningWageRate;
                        
                        const calculatedAmount = (entry.morning_hours > 0 || entry.night_hours > 0) 
                          ? morningEarnings + nightEarnings 
                          : totalHourlyEarnings;
                        
                        return calculatedAmount.toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2 sm:py-4 text-muted-foreground">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">No entries found</p>
            </div>
          )}
        </MobileCard>
      </MobileSection>
    </MobilePageWrapper>
  );
};

export default MyTimesheetPage;