import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Split, Trash2, User, Filter, RefreshCw, Globe2, Plus } from 'lucide-react';
import TimesheetUpload from '@/components/TimesheetUpload';
import TimesheetTable from '@/components/TimesheetTable';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import TimesheetExport from '@/components/TimesheetExport';
import AutoCalculateWages from '@/components/AutoCalculateWages';
import TimesheetEditDialog from '@/components/TimesheetEditDialog';
import { Badge } from '@/components/ui/badge';
import { Button as UIButton } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';
import { toast } from 'sonner';
import MobilePageWrapper, { MobileSection, MobileHeader } from '@/components/MobilePageWrapper';
import { getCompanyTimezone } from '@/utils/timezoneUtils';
interface DateRange {
  from: Date;
  to: Date;
}

const TimesheetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { timezone } = useCompanyTimezone();
  const [showUpload, setShowUpload] = useState(false);
  const [showNewEntryDialog, setShowNewEntryDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  // Helper: compute current pay period based on end-day (default 28)
  const computeCurrentPayPeriod = (endDay: number): DateRange => {
    const today = new Date();
    // Previous pay period end
    let prevEnd = new Date(today.getFullYear(), today.getMonth(), endDay);
    if (today.getDate() <= endDay) {
      prevEnd = new Date(today.getFullYear(), today.getMonth() - 1, endDay);
    }
    const nextEnd = new Date(prevEnd.getFullYear(), prevEnd.getMonth() + 1, endDay);
    const startDate = new Date(prevEnd);
    startDate.setDate(prevEnd.getDate() + 1); // day after previous end
    return { from: startDate, to: nextEnd };
  };

  // Default to current pay period
  const [dateRange, setDateRange] = useState<DateRange>(() => computeCurrentPayPeriod(28));
  const [payPeriodEndDay, setPayPeriodEndDay] = useState(28);

  // Load wage settings for accurate split calculations
  const { data: wageSettings } = useQuery({
    queryKey: ['wage-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wage_settings')
        .select('morning_start_time, morning_end_time, night_start_time, night_end_time')
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  // Load working hours window settings from company_settings
  const { data: workingHoursSettings } = useQuery({
    queryKey: ['working-hours-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('working_hours_window_enabled, working_hours_start_time, working_hours_end_time')
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  // Combine wage settings with working hours window settings
  const combinedWageSettings = wageSettings && workingHoursSettings ? {
    ...wageSettings,
    working_hours_window_enabled: workingHoursSettings.working_hours_window_enabled ?? true,
    working_hours_start_time: workingHoursSettings.working_hours_start_time ?? '08:00:00',
    working_hours_end_time: workingHoursSettings.working_hours_end_time ?? '01:00:00'
  } : wageSettings;

  // Reverted auto-calculate effect to prevent page issues

  // Fetch employees for the filter dropdown
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-filter', (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
      let q = supabase
        .from('employees')
        .select('id, staff_id, full_name, morning_wage_rate, night_wage_rate')
        .order('full_name');
      if (activeOrganizationId) {
        q = q.eq('organization_id', activeOrganizationId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

  const { data: timesheets, isLoading, refetch, error } = useQuery({
    queryKey: ['timesheets', dateRange, selectedEmployee, (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      try {
        const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

        // Helpers for date filters
        const applyDateFilter = (q: any) => {
          if (dateRange?.from && dateRange?.to) {
            return q
              .gte('clock_in_date', dateRange.from.toISOString().split('T')[0])
              .lte('clock_in_date', dateRange.to.toISOString().split('T')[0]);
          }
          return q;
        };

        // Build employee matching for legacy rows (organization_id is null)
        const allEmployeeIds = employees?.map(e => e.id) || [];
        const allStaffIds = employees?.map(e => e.staff_id).filter(Boolean) || [];
        const allNames = employees?.map(e => e.full_name).filter(Boolean) || [];

        // Query A: strictly current organization
        let queryOrg = supabase
          .from('timesheet_entries')
          .select('*');
        if (activeOrganizationId) {
          queryOrg = queryOrg.eq('organization_id', activeOrganizationId);
        }
        queryOrg = applyDateFilter(queryOrg);

        // Apply selected employee filter to Query A
        if (selectedEmployee && selectedEmployee !== 'all') {
          const selectedEmp = employees?.find(emp => emp.id === selectedEmployee);
          if (selectedEmp) {
            const conditions = [
              `employee_id.eq.${selectedEmployee}`,
              `employee_name.eq.${selectedEmp.staff_id}`,
              `employee_name.eq.${selectedEmp.full_name}`
            ];
            queryOrg = queryOrg.or(conditions.join(','));
          }
        }

        // Query B: legacy rows with null organization, but belonging to employees in this org
        let queryLegacy = supabase
          .from('timesheet_entries')
          .select('*')
          .is('organization_id', null);
        queryLegacy = applyDateFilter(queryLegacy);

        if (selectedEmployee && selectedEmployee !== 'all') {
          const selectedEmp = employees?.find(emp => emp.id === selectedEmployee);
          if (selectedEmp) {
            const legacyConditions = [
              `employee_id.eq.${selectedEmployee}`,
              `employee_name.eq.${selectedEmp.staff_id}`,
              `employee_name.eq.${selectedEmp.full_name}`
            ];
            queryLegacy = queryLegacy.or(legacyConditions.join(','));
          } else {
            // If not found, ensure no legacy matches
            queryLegacy = queryLegacy.eq('employee_id', '00000000-0000-0000-0000-000000000000');
          }
        } else {
          // All employees in current org
          if (allEmployeeIds.length > 0) {
            queryLegacy = queryLegacy.in('employee_id', allEmployeeIds);
          } else if (allStaffIds.length > 0 || allNames.length > 0) {
            // Fallback matching by names/staff ids
            const orParts: string[] = [];
            if (allStaffIds.length > 0) {
              const staffVals = allStaffIds.map((v: string) => `"${v}"`).join(',');
              orParts.push(`employee_name.in.(${staffVals})`);
            }
            if (allNames.length > 0) {
              const nameVals = allNames.map((v: string) => `"${v}"`).join(',');
              orParts.push(`employee_name.in.(${nameVals})`);
            }
            if (orParts.length > 0) {
              queryLegacy = queryLegacy.or(orParts.join(','));
            }
          }
        }

        const [resOrg, resLegacy] = await Promise.all([
          queryOrg.order('clock_in_date', { ascending: false }).limit(500),
          queryLegacy.order('clock_in_date', { ascending: false }).limit(500)
        ]);

        if (resOrg.error) throw resOrg.error;
        if (resLegacy.error) throw resLegacy.error;

        const combined = [...(resOrg.data || []), ...(resLegacy.data || [])];
        // Sort and cap to 500 combined
        combined.sort((a, b) => (a.clock_in_date < b.clock_in_date ? 1 : -1));
        return combined.slice(0, 500);
      } catch (error) {
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleEmployeeChange = useCallback((value: string) => {
    setSelectedEmployee(value);
    setSelectedRows([]); // Clear selected rows when changing employee filter
  }, []);

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
    setSelectedRows([]); // Clear selected rows when changing date range
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedEmployee('all');
    setDateRange(computeCurrentPayPeriod(payPeriodEndDay));
    setSelectedRows([]);
    toast.success('All filters cleared');
  }, [payPeriodEndDay]);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Data refreshed');
  }, [refetch]);

  // Calculate filter stats
  const totalEntries = timesheets?.length || 0;
  const selectedEmployeeName = selectedEmployee === 'all' ? 'All Employees' : 
    employees?.find(emp => emp.id === selectedEmployee)?.full_name || 'Unknown Employee';

  const hasActiveFilters = selectedEmployee !== 'all' || (dateRange && dateRange.from && dateRange.to);

  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="text-red-600 text-lg mb-2">Error loading timesheets</div>
          <div className="text-muted-foreground text-sm mb-4">
            {error.message || 'An error occurred while loading the data'}
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MobilePageWrapper>
      <MobileHeader 
        title={t('timesheets')}
        subtitle={`${totalEntries} total entries`}
         actions={
           <div className="flex items-center gap-1 sm:gap-2">
             <AutoCalculateWages />
             <Button onClick={handleRefresh} size="sm" variant="outline" className="h-7 sm:h-9">
               <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
             </Button>
             {(user?.role === 'admin' || user?.role === 'owner') && (
               <Button
                 onClick={() => setShowNewEntryDialog(true)}
                 className="bg-green-600 hover:bg-green-700 h-7 sm:h-9"
                 size="sm"
               >
                 <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                 <span className="hidden sm:inline ml-1">Add Entry</span>
               </Button>
             )}
             <Button
               onClick={() => setShowUpload(true)}
               className="bg-blue-600 hover:bg-blue-700 h-7 sm:h-9"
               size="sm"
             >
               <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline ml-1">Import</span>
             </Button>
              <TimesheetExport 
                selectedRows={selectedRows}
              />
           </div>
         }
      />

      <MobileSection>
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              Filtered
            </Badge>
          )}
          <span className="hidden sm:inline">•</span>
          <span className="text-xs">
            Selected: {selectedRows.length} items
          </span>
          <span className="hidden sm:inline">•</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <UIButton size="sm" variant="outline" className="h-7 sm:h-8">
                <Globe2 className="h-3.5 w-3.5 mr-1" /> {timezone || 'Africa/Cairo'}
              </UIButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Timezone</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { localStorage.setItem('companyTimezoneOverride', 'Africa/Cairo'); location.reload(); }}>Africa/Cairo (Default)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { localStorage.removeItem('companyTimezoneOverride'); location.reload(); }}>Use Company Setting</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { localStorage.setItem('companyTimezoneOverride', 'Europe/Athens'); location.reload(); }}>Europe/Athens</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { localStorage.setItem('companyTimezoneOverride', 'Europe/Istanbul'); location.reload(); }}>Europe/Istanbul</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { localStorage.setItem('companyTimezoneOverride', 'Asia/Dubai'); location.reload(); }}>Asia/Dubai</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </MobileSection>

      {/* Filters */}
      <MobileSection spacing="tight">
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          payPeriodEndDay={payPeriodEndDay}
          onPayPeriodEndDayChange={setPayPeriodEndDay}
        />
        
        {/* Employee Filter - Only show for admins */}
        {(user?.role === 'admin' || user?.role === 'owner') && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedEmployee} onValueChange={handleEmployeeChange} disabled={employeesLoading}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Filter by employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees?.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground">
                    Current: {selectedEmployeeName}
                  </div>
                </div>
                {hasActiveFilters && (
                  <Button
                    onClick={clearAllFilters}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </MobileSection>

      {/* Summary Section - Morning vs Night Hours Analysis */}
      {timesheets && timesheets.length > 0 && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Timesheet Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {(() => {
                // Calculate totals
                const totalHours = timesheets.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
                // Helpers using minute math like MyTimesheet
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
                
                // Calculate morning and night using wage settings windows when needed
                const totalMorningHours = timesheets.reduce((sum, entry) => {
                  if (entry.morning_hours && entry.morning_hours > 0) {
                    return sum + entry.morning_hours;
                  }
                  if (combinedWageSettings && entry.clock_in_time && entry.clock_out_time) {
                    let shiftStart = timeToMinutes(entry.clock_in_time);
                    let shiftEnd = timeToMinutes(entry.clock_out_time);
                    if (shiftEnd < shiftStart) shiftEnd += 24 * 60;
                    
                    // Apply working hours window filter if enabled
                    if (combinedWageSettings.working_hours_window_enabled) {
                      const workingStart = timeToMinutes(combinedWageSettings.working_hours_start_time || '08:00:00');
                      let workingEnd = timeToMinutes(combinedWageSettings.working_hours_end_time || '01:00:00');
                      if (workingEnd <= workingStart) workingEnd += 24 * 60;
                      
                      // Clamp shift times to working hours window
                      const payableStart = Math.max(shiftStart, workingStart);
                      const payableEnd = Math.min(shiftEnd, workingEnd);
                      
                      // If no overlap with working hours window, skip this entry
                      if (payableStart >= payableEnd) {
                        return sum;
                      }
                      
                      shiftStart = payableStart;
                      shiftEnd = payableEnd;
                    }
                    
                    const morningStart = timeToMinutes(combinedWageSettings.morning_start_time || '08:00:00');
                    const morningEnd = timeToMinutes(combinedWageSettings.morning_end_time || '17:00:00');
                    const minutes = overlapMinutes(shiftStart, shiftEnd, morningStart, morningEnd);
                    return sum + minutes / 60;
                  }
                  return sum;
                }, 0);

                const totalNightHours = timesheets.reduce((sum, entry) => {
                  if (entry.night_hours && entry.night_hours > 0) {
                    return sum + entry.night_hours;
                  }
                  if (combinedWageSettings && entry.clock_in_time && entry.clock_out_time) {
                    let shiftStart = timeToMinutes(entry.clock_in_time);
                    let shiftEnd = timeToMinutes(entry.clock_out_time);
                    if (shiftEnd < shiftStart) shiftEnd += 24 * 60;
                    
                    // Apply working hours window filter if enabled
                    if (combinedWageSettings.working_hours_window_enabled) {
                      const workingStart = timeToMinutes(combinedWageSettings.working_hours_start_time || '08:00:00');
                      let workingEnd = timeToMinutes(combinedWageSettings.working_hours_end_time || '01:00:00');
                      if (workingEnd <= workingStart) workingEnd += 24 * 60;
                      
                      // Clamp shift times to working hours window
                      const payableStart = Math.max(shiftStart, workingStart);
                      const payableEnd = Math.min(shiftEnd, workingEnd);
                      
                      // If no overlap with working hours window, skip this entry
                      if (payableStart >= payableEnd) {
                        return sum;
                      }
                      
                      shiftStart = payableStart;
                      shiftEnd = payableEnd;
                    }
                    
                    const nightStart = timeToMinutes(combinedWageSettings.night_start_time || '17:00:00');
                    let nightEnd = timeToMinutes(combinedWageSettings.night_end_time || '01:00:00');
                    if (nightEnd < nightStart) nightEnd += 24 * 60;
                    const minutes = overlapMinutes(shiftStart, shiftEnd, nightStart, nightEnd);
                    return sum + minutes / 60;
                  }
                  return sum;
                }, 0);

                const unassignedHours = Math.max(0, totalHours - (totalMorningHours + totalNightHours));
                
                // Calculate percentages
                const morningPercentage = totalHours > 0 ? (totalMorningHours / totalHours) * 100 : 0;
                const nightPercentage = totalHours > 0 ? (totalNightHours / totalHours) * 100 : 0;
                const totalEntries = timesheets.length;
                
                return (
                  <>
                    {/* Total Entries */}
                    <div className="bg-card border rounded-lg p-3 sm:p-4">
                      <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Entries</div>
                      <div className="text-lg sm:text-2xl font-bold text-primary">{totalEntries}</div>
                      <div className="text-xs text-muted-foreground">Timesheet records</div>
                    </div>

                    {/* Total Hours */}
                    <div className="bg-card border rounded-lg p-3 sm:p-4">
                      <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Hours</div>
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">All worked hours</div>
                    </div>

                    {/* Morning Hours */}
                    <div className="bg-card border rounded-lg p-3 sm:p-4">
                      <div className="text-xs sm:text-sm text-muted-foreground mb-1">Morning Hours</div>
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">{totalMorningHours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">
                        {morningPercentage.toFixed(1)}% of total
                      </div>
                    </div>

                    {/* Night Hours */}
                    <div className="bg-card border rounded-lg p-3 sm:p-4">
                      <div className="text-xs sm:text-sm text-muted-foreground mb-1">Night Hours</div>
                      <div className="text-lg sm:text-2xl font-bold text-purple-600">{totalNightHours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">
                        {nightPercentage.toFixed(1)}% of total
                      </div>
                    </div>

                    {/* Unassigned Hours (if any) */}
                    {unassignedHours > 0 && (
                      <div className="bg-card border rounded-lg p-3 sm:p-4">
                        <div className="text-xs sm:text-sm text-muted-foreground mb-1">Unassigned Hours</div>
                        <div className="text-lg sm:text-2xl font-bold">{unassignedHours.toFixed(1)}h</div>
                        <div className="text-xs text-muted-foreground">Outside morning/night or missing times</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            {/* Visual Breakdown Bar */}
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">Hours Distribution</div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                {(() => {
                  // Recalculate morning hours for visual bar
                  const calculatedMorningHours = timesheets.reduce((sum, entry) => {
                    if (entry.morning_hours && entry.morning_hours > 0) {
                      return sum + entry.morning_hours;
                    }
                    if (entry.clock_in_time && entry.clock_out_time && entry.clock_in_date) {
                      try {
                        const clockInTime = entry.clock_in_time.includes('.') ? entry.clock_in_time.split('.')[0] : entry.clock_in_time;
                        const clockOutTime = entry.clock_out_time.includes('.') ? entry.clock_out_time.split('.')[0] : entry.clock_out_time;
                        const clockInDateTime = new Date(`${entry.clock_in_date}T${clockInTime}`);
                        const clockOutDateTime = new Date(`${entry.clock_out_date || entry.clock_in_date}T${clockOutTime}`);
                        if (clockOutDateTime < clockInDateTime) {
                          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
                        }
                        const morningStart = new Date(entry.clock_in_date);
                        morningStart.setHours(8, 0, 0, 0);
                        const morningEnd = new Date(entry.clock_in_date);
                        morningEnd.setHours(17, 0, 0, 0);
                        const overlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
                        const overlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
                        if (overlapEnd > overlapStart) {
                          const morningHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
                          return sum + morningHours;
                        }
                      } catch (error) {
                        console.warn('Error calculating morning hours:', error);
                      }
                    }
                    return sum;
                  }, 0);

                  // Recalculate night hours for visual bar
                  const calculatedNightHours = timesheets.reduce((sum, entry) => {
                    if (entry.night_hours && entry.night_hours > 0) {
                      return sum + entry.night_hours;
                    }
                    if (entry.clock_in_time && entry.clock_out_time && entry.clock_in_date) {
                      try {
                        const clockInTime = entry.clock_in_time.includes('.') ? entry.clock_in_time.split('.')[0] : entry.clock_in_time;
                        const clockOutTime = entry.clock_out_time.includes('.') ? entry.clock_out_time.split('.')[0] : entry.clock_out_time;
                        const clockInDateTime = new Date(`${entry.clock_in_date}T${clockInTime}`);
                        const clockOutDateTime = new Date(`${entry.clock_out_date || entry.clock_in_date}T${clockOutTime}`);
                        if (clockOutDateTime < clockInDateTime) {
                          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
                        }
                        const nightStart = new Date(entry.clock_in_date);
                        nightStart.setHours(17, 0, 0, 0);
                        const nightEnd = new Date(entry.clock_in_date);
                        nightEnd.setDate(nightEnd.getDate() + 1);
                        nightEnd.setHours(1, 0, 0, 0);
                        const overlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
                        const overlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
                        if (overlapEnd > overlapStart) {
                          const nightHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
                          return sum + nightHours;
                        }
                      } catch (error) {
                        console.warn('Error calculating night hours:', error);
                      }
                    }
                    return sum;
                  }, 0);
                  
                  const calculatedTotalHours = timesheets.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
                  const barMorningPercentage = calculatedTotalHours > 0 ? (calculatedMorningHours / calculatedTotalHours) * 100 : 0;
                  const barNightPercentage = calculatedTotalHours > 0 ? (calculatedNightHours / calculatedTotalHours) * 100 : 0;
                  
                  return (
                    <div className="flex h-full">
                      <div 
                        className="bg-orange-500 h-full transition-all duration-300"
                        style={{ width: `${barMorningPercentage}%` }}
                        title={`Morning: ${barMorningPercentage.toFixed(1)}%`}
                      />
                      <div 
                        className="bg-purple-500 h-full transition-all duration-300"
                        style={{ width: `${barNightPercentage}%` }}
                        title={`Night: ${barNightPercentage.toFixed(1)}%`}
                      />
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Morning</span>
                <span>Night</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timesheet Entries - Full Width */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Timesheet Entries</span>
            {hasActiveFilters && (
              <Badge variant="outline" className="text-xs">
                Filtered View
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <TimesheetTable 
              data={timesheets || []} 
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
              onDataChange={refetch}
              dateRange={dateRange}
              selectedEmployee={selectedEmployee}
              wageSettings={combinedWageSettings as any}
              employees={employees as any}
            />
          )}
        </CardContent>
      </Card>

      {showUpload && (
        <TimesheetUpload
          onClose={() => setShowUpload(false)}
          onUploadComplete={refetch}
        />
      )}

      {showNewEntryDialog && (
        <TimesheetEditDialog
          entry={null}
          isOpen={showNewEntryDialog}
          onClose={() => setShowNewEntryDialog(false)}
          onUpdate={refetch}
          employees={employees}
          wageSettings={wageSettings}
        />
      )}
    </MobilePageWrapper>
  );
};

export default TimesheetsPage;