import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Split, Trash2, User, Filter, RefreshCw } from 'lucide-react';
import TimesheetUpload from '@/components/TimesheetUpload';
import TimesheetTable from '@/components/TimesheetTable';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import TimesheetExport from '@/components/TimesheetExport';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import MobilePageWrapper, { MobileSection, MobileHeader } from '@/components/MobilePageWrapper';
import { useMemo } from 'react';

interface DateRange {
  from: Date;
  to: Date;
}

const TimesheetsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  // Initialize with a proper date range - last 30 days by default
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  });
  const [payPeriodEndDay, setPayPeriodEndDay] = useState(28);

  // Fetch employees for the filter dropdown
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, staff_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch wage settings for calculating missing fields
  const { data: wageSettings } = useQuery({
    queryKey: ['wage-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wage_settings')
        .select('default_flat_wage_rate, morning_wage_rate, night_wage_rate, morning_start_time, morning_end_time, night_start_time, night_end_time')
        .single();
      if (error) throw error;
      return data;
    }
  });

  const { data: timesheets, isLoading, refetch, error } = useQuery({
    queryKey: ['timesheets', dateRange, selectedEmployee],
    queryFn: async () => {
      try {
        // Build query with filters
        let query = supabase
          .from('timesheet_entries')
          .select('*');

        // Apply date range filter
        if (dateRange?.from && dateRange?.to) {
          query = query
            .gte('clock_in_date', dateRange.from.toISOString().split('T')[0])
            .lte('clock_in_date', dateRange.to.toISOString().split('T')[0]);
        }

        // Apply employee filter
        if (selectedEmployee && selectedEmployee !== 'all') {
          // Get the selected employee's details for proper filtering
                  const selectedEmp = employees?.find(emp => emp.id === selectedEmployee);
        
        if (selectedEmp) {
            // Build OR conditions to match various ways employee data might be stored
            const conditions = [
              `employee_id.eq.${selectedEmployee}`, // Match by UUID
              `employee_name.eq.${selectedEmp.staff_id}`, // Match by staff_id (like EMP085382)
              `employee_name.eq.${selectedEmp.full_name}` // Match by full name (like Donia Amal)
            ];
            
            query = query.or(conditions.join(','));
          } else {
          }
        }

        // Execute query
        const { data: timesheetData, error: timesheetError } = await query.order('clock_in_date', { ascending: false }).limit(500);
        
        if (timesheetError) {
          throw timesheetError;
        }

        return timesheetData || [];
        
      } catch (error) {
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Compute fallback morning/night hours and total amount when missing
  const processedTimesheets = useMemo(() => {
    if (!timesheets || timesheets.length === 0) return [] as any[];

    const morningStart = wageSettings?.morning_start_time || '08:00:00';
    const morningEnd = wageSettings?.morning_end_time || '17:00:00';
    const nightStart = wageSettings?.night_start_time || '17:00:00';
    const nightEnd = wageSettings?.night_end_time || '01:00:00';
    const morningRate = wageSettings?.morning_wage_rate ?? 17;
    const nightRate = wageSettings?.night_wage_rate ?? 20;
    const flatRate = wageSettings?.default_flat_wage_rate ?? 20;

    const timeToMinutes = (timeStr?: string | null): number | null => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    return timesheets.map((entry: any) => {
      let morningHours = entry.morning_hours || 0;
      let nightHours = entry.night_hours || 0;

      // If missing split hours but we have shift times and total hours, compute overlaps
      if ((morningHours + nightHours) === 0 && (entry.total_hours || 0) > 0 && entry.clock_in_time && entry.clock_out_time) {
        const shiftStart = timeToMinutes((entry.clock_in_time || '').split('.')[0]);
        const shiftEndRaw = timeToMinutes((entry.clock_out_time || '').split('.')[0]);
        const mStart = timeToMinutes(morningStart)!;
        const mEnd = timeToMinutes(morningEnd)!;
        const nStart = timeToMinutes(nightStart)!;
        let nEnd = timeToMinutes(nightEnd)!;

        if (shiftStart !== null && shiftEndRaw !== null) {
          let shiftEnd = shiftEndRaw;
          if (shiftEnd < shiftStart) shiftEnd += 24 * 60; // overnight shift
          if (nEnd < nStart) nEnd += 24 * 60; // night crosses midnight

          const morningOverlapStart = Math.max(shiftStart, mStart);
          const morningOverlapEnd = Math.min(shiftEnd, mEnd);
          if (morningOverlapStart < morningOverlapEnd) {
            morningHours = (morningOverlapEnd - morningOverlapStart) / 60;
          }

          const nightOverlapStart = Math.max(shiftStart, nStart);
          const nightOverlapEnd = Math.min(shiftEnd, nEnd);
          if (nightOverlapStart < nightOverlapEnd) {
            nightHours = (nightOverlapEnd - nightOverlapStart) / 60;
          }

          // Normalize to not exceed total hours; assign remainder to predominant period
          const totalCalculated = morningHours + nightHours;
          const finalHours = entry.actual_hours || entry.total_hours || 0;
          if (totalCalculated > finalHours && totalCalculated > 0) {
            const ratio = finalHours / totalCalculated;
            morningHours *= ratio;
            nightHours *= ratio;
          } else if (totalCalculated < finalHours) {
            const remaining = finalHours - totalCalculated;
            if (morningHours >= nightHours) morningHours += remaining; else nightHours += remaining;
          }
        } else {
          // Fallback: assign all hours to morning
          morningHours = entry.total_hours || 0;
        }
      }

      const hasAnyAmount = (entry.total_card_amount_split || 0) > 0 || (entry.total_card_amount_flat || 0) > 0;
      const splitAmount = (morningHours * morningRate) + (nightHours * nightRate);
      const flatAmount = (entry.total_hours || 0) * flatRate;

      return {
        ...entry,
        morning_hours: morningHours,
        night_hours: nightHours,
        total_card_amount_split: (entry.total_card_amount_split && entry.total_card_amount_split > 0) ? entry.total_card_amount_split : splitAmount,
        total_card_amount_flat: (entry.total_card_amount_flat && entry.total_card_amount_flat > 0) ? entry.total_card_amount_flat : flatAmount,
        is_split_calculation: entry.is_split_calculation ?? true,
      };
    });
  }, [timesheets, wageSettings]);

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
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setDateRange({ from: thirtyDaysAgo, to: today });
    setSelectedRows([]);
    toast.success('All filters cleared');
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Data refreshed');
  }, [refetch]);

  // Calculate filter stats
  const totalEntries = processedTimesheets?.length || 0;
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
             <Button onClick={handleRefresh} size="sm" variant="outline" className="h-7 sm:h-9">
               <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
             </Button>
             <Button
               onClick={() => setShowUpload(true)}
               className="bg-blue-600 hover:bg-blue-700 h-7 sm:h-9"
               size="sm"
             >
               <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
               <span className="hidden sm:inline ml-1">Import</span>
             </Button>
              <TimesheetExport 
                selectedRows={[]}
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
        {user?.role === 'admin' && (
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
      {processedTimesheets && processedTimesheets.length > 0 && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Timesheet Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {(() => {
                // Calculate totals
                const totalHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.total_hours || 0), 0);
                const totalMorningHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.morning_hours || 0), 0);
                const totalNightHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.night_hours || 0), 0);
                
                // Calculate percentages
                const morningPercentage = totalHours > 0 ? (totalMorningHours / totalHours) * 100 : 0;
                const nightPercentage = totalHours > 0 ? (totalNightHours / totalHours) * 100 : 0;
                const totalEntries = processedTimesheets.length;
                
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
                  </>
                );
              })()}
            </div>
            
            {/* Visual Breakdown Bar */}
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">Hours Distribution</div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                {(() => {
                  const totalHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.total_hours || 0), 0);
                  const totalMorningHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.morning_hours || 0), 0);
                  const totalNightHours = processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.night_hours || 0), 0);
                  
                  const morningPercentage = totalHours > 0 ? (totalMorningHours / totalHours) * 100 : 0;
                  const nightPercentage = totalHours > 0 ? (totalNightHours / totalHours) * 100 : 0;
                  
                  return (
                    <div className="flex h-full">
                      <div 
                        className="bg-orange-500 h-full transition-all duration-300"
                        style={{ width: `${morningPercentage}%` }}
                        title={`Morning: ${morningPercentage.toFixed(1)}%`}
                      />
                      <div 
                        className="bg-purple-500 h-full transition-all duration-300"
                        style={{ width: `${nightPercentage}%` }}
                        title={`Night: ${nightPercentage.toFixed(1)}%`}
                      />
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Morning ({((processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.morning_hours || 0), 0) / Math.max(processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.total_hours || 0), 0), 1)) * 100).toFixed(1)}%)</span>
                <span>Night ({((processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.night_hours || 0), 0) / Math.max(processedTimesheets.reduce((sum: number, entry: any) => sum + (entry.total_hours || 0), 0), 1)) * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="lg:col-span-4 xl:col-span-3">
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
                data={processedTimesheets || []} 
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onDataChange={refetch}
                dateRange={dateRange}
                selectedEmployee={selectedEmployee}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 xl:col-span-1">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full flex items-center space-x-2"
              disabled={selectedRows.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('deleteSelected')}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {showUpload && (
        <TimesheetUpload
          onClose={() => setShowUpload(false)}
          onUploadComplete={refetch}
        />
      )}
    </MobilePageWrapper>
  );
};

export default TimesheetsPage;