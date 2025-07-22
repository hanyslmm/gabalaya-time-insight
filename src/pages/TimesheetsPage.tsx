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

  const { data: timesheets, isLoading, refetch, error } = useQuery({
    queryKey: ['timesheets', dateRange, selectedEmployee],
    queryFn: async () => {
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
        query = query.eq('employee_id', selectedEmployee);
      }

      // Fetch timesheet entries, employees, and wage settings in parallel
      const [timesheetResult, employeesResult, wageSettingsResult] = await Promise.all([
        query.order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('staff_id, full_name, morning_wage_rate, night_wage_rate'),
        supabase
          .from('wage_settings')
          .select('*')
          .single()
      ]);
      
      if (timesheetResult.error) throw timesheetResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (wageSettingsResult.error) throw wageSettingsResult.error;
      
      // Create employee mapping for names and rates
      const employeeMap = new Map();
      (employeesResult.data || []).forEach(emp => {
        employeeMap.set(emp.staff_id, emp);
        employeeMap.set(emp.full_name, emp); // Also map by name for lookup
      });
      
      const wageSettings = wageSettingsResult.data;
      
      // Map employee IDs to names and auto-calculate split wages
      const mappedData = await Promise.all((timesheetResult.data || []).map(async (entry) => {
        const employee = employeeMap.get(entry.employee_name) || employeeMap.get(entry.employee_id);
        const mappedEntry = {
          ...entry,
          employee_name: employee ? employee.full_name : entry.employee_name, // Use full name if found
          employees: employee ? {
            morning_wage_rate: employee.morning_wage_rate,
            night_wage_rate: employee.night_wage_rate
          } : null
        };
        
        // Auto-calculate split wages if not already calculated
        if (!entry.is_split_calculation && wageSettings) {
          const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
          const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
          
          // Handle next day scenario
          if (clockOutDateTime < clockInDateTime) {
            clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
          }

          // Create time boundaries
          const baseDate = new Date(entry.clock_in_date);
          
          const morningStart = new Date(baseDate);
          const [morningStartHour, morningStartMin] = wageSettings.morning_start_time.split(':');
          morningStart.setHours(parseInt(morningStartHour), parseInt(morningStartMin), 0, 0);
          
          const morningEnd = new Date(baseDate);
          const [morningEndHour, morningEndMin] = wageSettings.morning_end_time.split(':');
          morningEnd.setHours(parseInt(morningEndHour), parseInt(morningEndMin), 0, 0);
          
          const nightStart = new Date(baseDate);
          const [nightStartHour, nightStartMin] = wageSettings.night_start_time.split(':');
          nightStart.setHours(parseInt(nightStartHour), parseInt(nightStartMin), 0, 0);
          
          const nightEnd = new Date(baseDate);
          const [nightEndHour, nightEndMin] = wageSettings.night_end_time.split(':');
          nightEnd.setHours(parseInt(nightEndHour), parseInt(nightEndMin), 0, 0);
          
          if (nightEnd <= nightStart) {
            nightEnd.setDate(nightEnd.getDate() + 1);
          }

          let morningHours = 0;
          let nightHours = 0;

          // Calculate morning hours overlap
          const morningOverlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
          const morningOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
          
          if (morningOverlapEnd > morningOverlapStart) {
            morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
          }

          // Calculate night hours overlap
          const nightOverlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
          const nightOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
          
          if (nightOverlapEnd > nightOverlapStart) {
            nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
          }

          // Ensure total hours don't exceed actual worked hours
          const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
          const calculatedTotal = morningHours + nightHours;
          
          if (calculatedTotal > totalWorkedHours) {
            const ratio = totalWorkedHours / calculatedTotal;
            morningHours *= ratio;
            nightHours *= ratio;
          }

          mappedEntry.morning_hours = morningHours;
          mappedEntry.night_hours = nightHours;
          
          const morningWageRate = employee?.morning_wage_rate || wageSettings.morning_wage_rate;
          const nightWageRate = employee?.night_wage_rate || wageSettings.night_wage_rate;
          
          mappedEntry.total_card_amount_split = (morningHours * morningWageRate) + (nightHours * nightWageRate);
        }
        
        return mappedEntry;
      }));
      
      return mappedData;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('timesheets')}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                {totalEntries} total entries
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Filtered
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('import')}
            </Button>
            <div className="w-full sm:w-auto">
              <TimesheetExport selectedRows={selectedRows} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
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
      </div>

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
                data={timesheets || []} 
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
    </div>
  );
};

export default TimesheetsPage;