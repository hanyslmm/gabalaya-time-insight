
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, Split, Trash2, User } from 'lucide-react';
import TimesheetUpload from '@/components/TimesheetUpload';
import TimesheetTable from '@/components/TimesheetTable';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import TimesheetExport from '@/components/TimesheetExport';

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
  const { data: employees } = useQuery({
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

  const { data: timesheets, isLoading, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: async () => {
      // Fetch timesheet entries, employees, and wage settings in parallel
      const [timesheetResult, employeesResult, wageSettingsResult] = await Promise.all([
        supabase
          .from('timesheet_entries')
          .select('*')
          .order('created_at', { ascending: false }),
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

          // Use individual employee rates or fall back to default
          const employeeMorningRate = mappedEntry.employees?.morning_wage_rate || wageSettings.morning_wage_rate;
          const employeeNightRate = mappedEntry.employees?.night_wage_rate || wageSettings.night_wage_rate;

          const totalSplitAmount = (morningHours * employeeMorningRate) + (nightHours * employeeNightRate);

          // Update the entry in database
          const { error } = await supabase
            .from('timesheet_entries')
            .update({
              morning_hours: Math.max(0, parseFloat(morningHours.toFixed(2))),
              night_hours: Math.max(0, parseFloat(nightHours.toFixed(2))),
              total_card_amount_split: Math.max(0, parseFloat(totalSplitAmount.toFixed(2))),
              is_split_calculation: true
            })
            .eq('id', entry.id);

          if (!error) {
            mappedEntry.morning_hours = Math.max(0, parseFloat(morningHours.toFixed(2)));
            mappedEntry.night_hours = Math.max(0, parseFloat(nightHours.toFixed(2)));
            mappedEntry.total_card_amount_split = Math.max(0, parseFloat(totalSplitAmount.toFixed(2)));
            mappedEntry.is_split_calculation = true;
          }
        }
        
        return mappedEntry;
      }));
      
      return mappedData;
    }
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('timesheets')}</h1>
          <p className="mt-2 text-sm text-gray-600">Manage timesheet data and wage calculations</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Button 
            onClick={() => setShowUpload(true)} 
            className="flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            <span>{t('uploadTimesheet')}</span>
          </Button>
          <div className="w-full sm:w-auto">
            <TimesheetExport selectedRows={selectedRows} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          payPeriodEndDay={payPeriodEndDay}
          onPayPeriodEndDayChange={setPayPeriodEndDay}
        />
        
        {/* Employee Filter - Only show for admins */}
        {user?.role === 'admin' && employees && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="lg:col-span-4 xl:col-span-3">
          <CardHeader>
            <CardTitle>Timesheet Entries</CardTitle>
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
