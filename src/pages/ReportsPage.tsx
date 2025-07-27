import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MobileDropdownTabs from '@/components/MobileDropdownTabs';
import { Button } from '@/components/ui/button';
import { Calendar, Download, FileBarChart, Users, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import { HRAnalytics } from '@/components/HRAnalytics';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import MobilePageWrapper, { MobileSection, MobileHeader } from '@/components/MobilePageWrapper';

interface DateRange {
  from: Date;
  to: Date;
}

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  
  // Set default date range to cover more data - last 6 months
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    return { 
      from: sixMonthsAgo, 
      to: today 
    };
  });

  // Get wage settings for calculations
  const { data: wageSettings, isLoading: wageLoading, error: wageError } = useQuery({
    queryKey: ['wage-settings'],
    queryFn: async () => {
      console.log('Fetching wage settings...');
      const { data, error } = await supabase
        .from('wage_settings')
        .select('*')
        .single();
      
      if (error) {
        console.error('Wage settings error:', error);
        throw error;
      }
      console.log('Wage settings loaded:', data);
      return data;
    }
  });

  // Raw timesheet data query with better debugging
  const { data: rawTimesheetData, isLoading: timesheetLoading, error: timesheetError } = useQuery({
    queryKey: ['raw-timesheet-data', dateRange],
    queryFn: async () => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      
      console.log('=== FETCHING TIMESHEET DATA ===');
      console.log('Date range:', { fromDate, toDate });
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .gte('clock_in_date', fromDate)
        .lte('clock_in_date', toDate)
        .order('clock_in_date', { ascending: false });
      
      if (error) {
        console.error('Timesheet query error:', error);
        throw error;
      }
      
      console.log('Raw timesheet entries found:', data?.length || 0);
      console.log('Sample entries:', data?.slice(0, 3));
      
      return data || [];
    }
  });

  // Get all employees for name mapping
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-for-reports'],
    queryFn: async () => {
      console.log('Fetching employees...');
      const { data, error } = await supabase
        .from('employees')
        .select('id, staff_id, full_name');
      
      if (error) {
        console.error('Employees error:', error);
        throw error;
      }
      
      console.log('Employees loaded:', data?.length || 0);
      return data || [];
    }
  });

  // Process attendance report with better error handling
  const attendanceReport = React.useMemo(() => {
    if (!rawTimesheetData || !employees || !wageSettings) {
      console.log('Missing data for attendance report:', {
        hasTimesheet: !!rawTimesheetData,
        hasEmployees: !!employees,
        hasWageSettings: !!wageSettings
      });
      return [];
    }

    console.log('=== PROCESSING ATTENDANCE REPORT ===');
    
    // Create employee name mapping
    const employeeMap = new Map();
    employees.forEach(emp => {
      employeeMap.set(emp.staff_id, emp.full_name);
      employeeMap.set(emp.full_name, emp.full_name);
      employeeMap.set(emp.id, emp.full_name);
    });

    const processedData = rawTimesheetData.map(entry => {
      let morningHours = entry.morning_hours || 0;
      let nightHours = entry.night_hours || 0;

      // If no morning/night hours calculated, try to calculate or use total
      if (morningHours === 0 && nightHours === 0 && entry.total_hours > 0) {
        // Simple fallback: assign all hours to morning for now
        morningHours = entry.total_hours;
        console.log(`Assigned ${entry.total_hours}h to morning for ${entry.employee_name}`);
      }

      const displayName = employeeMap.get(entry.employee_name) || 
                         employeeMap.get(entry.employee_id) || 
                         entry.employee_name;

      return {
        ...entry,
        display_name: displayName,
        calculated_morning_hours: Math.max(0, morningHours),
        calculated_night_hours: Math.max(0, nightHours),
        total_card_amount_flat: Math.round(entry.total_card_amount_flat || 0)
      };
    });

    console.log('Processed attendance entries:', processedData.length);
    return processedData;
  }, [rawTimesheetData, employees, wageSettings]);

  // Calculate payroll summary
  const payrollSummary = React.useMemo(() => {
    if (!attendanceReport || attendanceReport.length === 0) {
      return [];
    }

    console.log('=== CALCULATING PAYROLL SUMMARY ===');

    // Group by employee
    const grouped = attendanceReport.reduce((acc, entry) => {
      const key = entry.display_name || entry.employee_name;
      if (!acc[key]) {
        acc[key] = {
          employee_name: key,
          total_hours: 0,
          morning_hours: 0,
          night_hours: 0,
          shifts: 0,
          total_flat_amount: 0,
          total_split_amount: 0
        };
      }

      acc[key].total_hours += entry.total_hours || 0;
      acc[key].morning_hours += entry.calculated_morning_hours || 0;
      acc[key].night_hours += entry.calculated_night_hours || 0;
      acc[key].shifts += 1;
      acc[key].total_flat_amount += entry.total_card_amount_flat || 0;
      acc[key].total_split_amount += entry.total_card_amount_split || 0;

      return acc;
    }, {} as any);

    const summary = Object.values(grouped);
    console.log('Payroll summary calculated:', summary.length, 'employees');
    return summary;
  }, [attendanceReport]);

  // Export functionality
  const exportReport = (type: string) => {
    try {
      let data: any[] = [];
      let filename = '';

      if (type === 'attendance') {
        data = attendanceReport.map(entry => ({
          'Employee': entry.display_name,
          'Date': entry.clock_in_date,
          'Clock In': entry.clock_in_time,
          'Clock Out': entry.clock_out_time,
          'Total Hours': entry.total_hours?.toFixed(2),
          'Morning Hours': entry.calculated_morning_hours?.toFixed(2),
          'Night Hours': entry.calculated_night_hours?.toFixed(2),
          'Amount (LE)': entry.total_card_amount_flat
        }));
        filename = `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      } else if (type === 'payroll') {
        data = payrollSummary.map(summary => ({
          'Employee': summary.employee_name,
          'Total Hours': summary.total_hours?.toFixed(2),
          'Morning Hours': summary.morning_hours?.toFixed(2),
          'Night Hours': summary.night_hours?.toFixed(2),
          'Shifts': summary.shifts,
          'Total Amount (LE)': Math.round(summary.total_split_amount || 0)
        }));
        filename = `payroll_summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      }

      if (data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'attendance' ? 'Attendance' : 'Payroll');
      XLSX.writeFile(wb, filename);
      
      toast.success(`${type} report exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast.info('File import functionality coming soon!');
  };

  // Loading state
  if (wageLoading || timesheetLoading || employeesLoading) {
    return (
      <MobilePageWrapper>
        <MobileHeader title="Reports" subtitle="Loading..." />
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobilePageWrapper>
    );
  }

  // Error state
  if (wageError || timesheetError) {
    return (
      <MobilePageWrapper>
        <MobileHeader title="Reports" subtitle="Error loading data" />
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load reports data. Please try again.</p>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="text-xs mt-2 p-2 bg-muted rounded">
                {JSON.stringify(wageError || timesheetError, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </MobilePageWrapper>
    );
  }

  return (
    <MobilePageWrapper>
      <MobileHeader 
        title="Reports" 
        subtitle={`${attendanceReport.length} entries found`}
      />

      <MobileSection>
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          payPeriodEndDay={28}
          onPayPeriodEndDayChange={() => {}}
        />
      </MobileSection>

      <MobileDropdownTabs
        tabs={[
          {
            value: "attendance",
            label: "Attendance Report",
            content: (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Attendance Report
                    </CardTitle>
                    <Button
                      onClick={() => exportReport('attendance')}
                      variant="outline"
                      size="sm"
                      disabled={attendanceReport.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary Section */}
                  {attendanceReport.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total Shifts</p>
                        <p className="text-2xl font-bold text-primary">{attendanceReport.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {attendanceReport.reduce((sum, entry) => sum + (entry.total_hours || 0), 0).toFixed(1)}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Morning Hours</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {attendanceReport.reduce((sum, entry) => sum + (entry.calculated_morning_hours || 0), 0).toFixed(1)}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Night Hours</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {attendanceReport.reduce((sum, entry) => sum + (entry.calculated_night_hours || 0), 0).toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  )}

                  {attendanceReport.length === 0 ? (
                    <div className="text-center py-8">
                      <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                      <p className="text-muted-foreground mb-4">No timesheet entries found for the selected date range.</p>
                      <div className="bg-muted/50 rounded-lg p-4 mb-4 text-left max-w-md mx-auto">
                        <h4 className="font-semibold mb-2">To see data in reports:</h4>
                        <ol className="text-sm space-y-1 list-decimal list-inside">
                          <li>Employees need to clock in/out using the Clock In/Out page</li>
                          <li>Or import timesheet data using the Import tab above</li>
                          <li>Adjust the date range filter to include days with data</li>
                          <li>Current range: {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}</li>
                        </ol>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        💡 Try expanding the date range to the last 3-6 months to find existing data.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Total Hours</TableHead>
                            <TableHead>Morning Hours</TableHead>
                            <TableHead>Night Hours</TableHead>
                            <TableHead>Amount (LE)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceReport.map((entry, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{entry.display_name}</TableCell>
                              <TableCell>{entry.clock_in_date}</TableCell>
                              <TableCell>{entry.clock_in_time}</TableCell>
                              <TableCell>{entry.clock_out_time || 'Active'}</TableCell>
                              <TableCell>{entry.total_hours?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{entry.calculated_morning_hours?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{entry.calculated_night_hours?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{entry.total_card_amount_flat || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          },
          {
            value: "payroll",
            label: "Payroll Summary",
            content: (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Payroll Summary
                    </CardTitle>
                    <Button
                      onClick={() => exportReport('payroll')}
                      variant="outline"
                      size="sm"
                      disabled={payrollSummary.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {payrollSummary.length === 0 ? (
                    <div className="text-center py-8">
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Payroll Data</h3>
                      <p className="text-muted-foreground">No payroll data available for the selected period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Total Hours</TableHead>
                            <TableHead>Morning Hours</TableHead>
                            <TableHead>Night Hours</TableHead>
                            <TableHead>Shifts</TableHead>
                            <TableHead>Total Amount (LE)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollSummary.map((summary: any, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{summary.employee_name}</TableCell>
                              <TableCell>{summary.total_hours?.toFixed(2)}</TableCell>
                              <TableCell>{summary.morning_hours?.toFixed(2)}</TableCell>
                              <TableCell>{summary.night_hours?.toFixed(2)}</TableCell>
                              <TableCell>{summary.shifts}</TableCell>
                              <TableCell>{Math.round(summary.total_split_amount || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          },
          {
            value: "analytics",
            label: "Analytics",
            content: <HRAnalytics dateRange={dateRange} />
          },
          {
            value: "import",
            label: "Import Data",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload a CSV or Excel file to import employee data
                    </p>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">CSV or Excel (MAX. 10MB)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileImport}
                        />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }
        ]}
      />
    </MobilePageWrapper>
  );
};

export default ReportsPage;
