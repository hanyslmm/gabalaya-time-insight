import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, DollarSign, Calendar, TrendingUp, Calculator } from 'lucide-react';
import MobilePageWrapper, { MobileSection, MobileCard, MobileHeader } from '@/components/MobilePageWrapper';
import { getCompanyTimezone } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
// Simple format function for hours display
const formatHours = (hours: number) => hours.toFixed(2);

const MyTimesheetPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
      
      // First, get all possible employee names for this user
      const possibleNames = [user.username]; // Start with username
      
      // Try to get employee record by staff_id
      const { data: employeeData } = await supabase
        .from('employees')
        .select('full_name, id')
        .eq('staff_id', user.username)
        .maybeSingle();
      
      if (employeeData?.full_name && !possibleNames.includes(employeeData.full_name)) {
        possibleNames.push(employeeData.full_name);
      }
      
      // Try admin_users table as fallback
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('full_name')
        .eq('username', user.username)
        .maybeSingle();
      
      if (adminData?.full_name && !possibleNames.includes(adminData.full_name)) {
        possibleNames.push(adminData.full_name);
      }
      
      console.log('Searching for timesheet entries with names:', possibleNames);
      
      // Build query to search for any of the possible names using ILIKE for case-insensitive partial matching
      const nameConditions = possibleNames.map(name => `employee_name.ilike.%${name}%`).join(',');
      
      const query = supabase
        .from('timesheet_entries')
        .select('*')
        .or(nameConditions)
        .gte('clock_in_date', startDate)
        .order('clock_in_date', { ascending: false });
        
      if (filterType === 'month') {
        query.lt('clock_in_date', endDate);
      } else {
        query.lte('clock_in_date', endDate);
      }

      const { data, error } = await query;
      
      console.log('Timesheet query result:', { 
        possibleNames, 
        startDate, 
        endDate, 
        dataCount: data?.length, 
        error: error?.message 
      });

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
      const { data } = await supabase
        .from('wage_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  const totalHours = timesheetData?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
  
  // Helpers for split-hours calculation using minute math (timezone-agnostic)
  const timeToMinutes = (timeStr: string): number => {
    const clean = (timeStr || '00:00:00').split('.')[0];
    const [h, m] = clean.split(':').map((v) => parseInt(v, 10));
    return (h % 24) * 60 + (m % 60);
  };

  const overlapMinutes = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    return Math.max(0, end - start);
  };

  // Calculate morning and night hours with robust minute-based fallback
  const totalMorningHours = timesheetData?.reduce((sum, entry) => {
    // Use stored morning_hours if available and greater than 0
    if (entry.morning_hours && entry.morning_hours > 0) {
      return sum + entry.morning_hours;
    }
    
    // Calculate from time periods if we have complete shift data
    if (wageSettings && entry.clock_in_time && entry.clock_out_time) {
      const shiftStart = timeToMinutes(entry.clock_in_time);
      let shiftEnd = timeToMinutes(entry.clock_out_time);
      // Handle overnight
      if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

      const morningStart = timeToMinutes(wageSettings.morning_start_time || '08:00:00');
      const morningEnd = timeToMinutes(wageSettings.morning_end_time || '17:00:00');

      const minutes = overlapMinutes(shiftStart, shiftEnd, morningStart, morningEnd);
      console.log('Morning calc for entry:', entry.id, {
        shiftStart, shiftEnd, morningStart, morningEnd, minutes,
        wageSettings: wageSettings ? 'loaded' : 'missing'
      });
      return sum + minutes / 60;
    }
    return sum;
  }, 0) || 0;
  
  const totalNightHours = timesheetData?.reduce((sum, entry) => {
    // Use stored night_hours if available and greater than 0
    if (entry.night_hours && entry.night_hours > 0) {
      return sum + entry.night_hours;
    }
    
    // Calculate from time periods if we have complete shift data
    if (wageSettings && entry.clock_in_time && entry.clock_out_time) {
      const shiftStart = timeToMinutes(entry.clock_in_time);
      let shiftEnd = timeToMinutes(entry.clock_out_time);
      if (shiftEnd < shiftStart) shiftEnd += 24 * 60; // overnight shift

      const nightStart = timeToMinutes(wageSettings.night_start_time || '17:00:00');
      let nightEnd = timeToMinutes(wageSettings.night_end_time || '01:00:00');
      if (nightEnd < nightStart) nightEnd += 24 * 60; // crosses midnight

      const minutes = overlapMinutes(shiftStart, shiftEnd, nightStart, nightEnd);
      console.log('Night calc for entry:', entry.id, {
        shiftStart, shiftEnd, nightStart, nightEnd, minutes,
        wageSettings: wageSettings ? 'loaded' : 'missing'
      });
      return sum + minutes / 60;
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

  // Helper to resolve wage settings with safe defaults
  const getResolvedWageSettings = async () => {
    if (wageSettings) return wageSettings;
    
    // Return safe defaults if no wage settings
    return {
      morning_start_time: '08:00:00',
      morning_end_time: '17:00:00',
      night_start_time: '17:00:00',
      night_end_time: '01:00:00',
    };
  };

  // Auto-calculate missing morning/night hours once data is available
  useEffect(() => {
    let cancelled = false;
    const autoCalculate = async () => {
      try {
        if (!timesheetData || timesheetData.length === 0) return;
        const ws = await getResolvedWageSettings();
        const entriesToUpdate = timesheetData.filter(entry =>
          entry.clock_out_time &&
          ((entry.morning_hours === 0 || entry.morning_hours === null) &&
           (entry.night_hours === 0 || entry.night_hours === null))
        );
        if (entriesToUpdate.length === 0) return;

        for (const entry of entriesToUpdate) {
          const shiftStart = timeToMinutes(entry.clock_in_time);
          let shiftEnd = timeToMinutes(entry.clock_out_time!);
          if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

          const morningStart = timeToMinutes(ws.morning_start_time || '08:00:00');
          const morningEnd = timeToMinutes(ws.morning_end_time || '17:00:00');
          const nightStart = timeToMinutes(ws.night_start_time || '17:00:00');
          let nightEnd = timeToMinutes(ws.night_end_time || '01:00:00');
          if (nightEnd < nightStart) nightEnd += 24 * 60;

          const morningMinutes = overlapMinutes(shiftStart, shiftEnd, morningStart, morningEnd);
          const nightMinutes = overlapMinutes(shiftStart, shiftEnd, nightStart, nightEnd);

          await supabase
            .from('timesheet_entries')
            .update({
              morning_hours: morningMinutes / 60,
              night_hours: nightMinutes / 60,
              is_split_calculation: true
            })
            .eq('id', entry.id);
        }

        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['my-timesheet'] });
        }
      } catch {
        // non-blocking
      }
    };
    autoCalculate();
    return () => { cancelled = true; };
  }, [wageSettings, timesheetData, queryClient]);

  // Mutation to calculate and store missing morning/night hours
  const calculateHoursMutation = useMutation({
    mutationFn: async () => {
      if (!timesheetData) {
        throw new Error('No timesheet data');
      }

      const ws = await getResolvedWageSettings();

      const entriesToUpdate = timesheetData.filter(entry => {
        if (!entry.clock_out_time) return false;
        const m = Number(entry.morning_hours || 0);
        const n = Number(entry.night_hours || 0);
        const t = Number(entry.total_hours || 0);
        const diff = Math.abs((m + n) - t);
        return diff > 0.02; // recalc when split doesn't match total
      });

      if (entriesToUpdate.length === 0) {
        throw new Error('No entries need recalculation');
      }

      for (const entry of entriesToUpdate) {
        const shiftStart = timeToMinutes(entry.clock_in_time);
        let shiftEnd = timeToMinutes(entry.clock_out_time!);
        if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

        const morningStart = timeToMinutes(ws.morning_start_time || '08:00:00');
        const morningEnd = timeToMinutes(ws.morning_end_time || '17:00:00');
        const nightStart = timeToMinutes(ws.night_start_time || '17:00:00');
        let nightEnd = timeToMinutes(ws.night_end_time || '01:00:00');
        if (nightEnd <= nightStart) nightEnd += 24 * 60;

        // Overlaps across repeating windows
        const morningMinutesBase = overlapMinutes(shiftStart, shiftEnd, morningStart, morningEnd)
          + overlapMinutes(shiftStart, shiftEnd, morningStart + 24 * 60, morningEnd + 24 * 60);
        const nightMinutesBase = overlapMinutes(shiftStart, shiftEnd, nightStart, nightEnd)
          + overlapMinutes(shiftStart, shiftEnd, nightStart + 24 * 60, nightEnd + 24 * 60);

        const totalWorked = shiftEnd - shiftStart;
        let mMin = morningMinutesBase; let nMin = nightMinutesBase;
        const accounted = mMin + nMin;
        if (accounted < totalWorked) {
          const rem = totalWorked - accounted;
          if (mMin >= nMin) mMin += rem; else nMin += rem;
        }

        const { error } = await supabase
          .from('timesheet_entries')
          .update({
            morning_hours: mMin / 60,
            night_hours: nMin / 60,
            is_split_calculation: true
          })
          .eq('id', entry.id);

        if (error) {
          console.error(`Failed to update entry ${entry.id}:`, error);
        }
      }

      return entriesToUpdate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['my-timesheet'] });
      toast.success(`Calculated hours for ${count} entries!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to calculate hours');
    }
  });

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

        {/* Calculate Hours Button */}
        {timesheetData && timesheetData.some(entry => 
          entry.clock_out_time && 
          (entry.morning_hours === 0 || entry.morning_hours === null) && 
          (entry.night_hours === 0 || entry.night_hours === null)
        ) && (
          <Button 
            onClick={() => calculateHoursMutation.mutate()}
            disabled={calculateHoursMutation.isPending}
            className="w-full mt-2"
            variant="outline"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {calculateHoursMutation.isPending ? 'Calculating...' : 'Calculate Missing Hours'}
          </Button>
        )}
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