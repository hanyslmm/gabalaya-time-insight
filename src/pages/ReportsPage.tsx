import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MobileDropdownTabs from '@/components/MobileDropdownTabs';
import { Button } from '@/components/ui/button';
import { Calendar, Download, FileBarChart, Users, FileSpreadsheet, Upload } from 'lucide-react';
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

interface DateRange {
  from: Date;
  to: Date;
}

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
    to: new Date() 
  });

  // Get wage settings for calculations
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

  // Employee Attendance Report - Properly map employee names
  const { data: attendanceReport } = useQuery({
    queryKey: ['attendance-report', dateRange],
    queryFn: async () => {
      // First get all employees to create a mapping
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('staff_id, full_name');

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        throw employeesError;
      }

      // Create a map of staff_id to full_name
      const employeeMap = new Map();
      employeesData?.forEach(emp => {
        employeeMap.set(emp.staff_id, emp.full_name);
      });

      // Now get timesheet entries
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select(`
          employee_name,
          employee_id,
          total_hours,
          total_card_amount_flat,
          clock_in_date,
          clock_out_date
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('clock_in_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching attendance report:', error);
        throw error;
      }
      
      // Map employee names properly
      const processedData = data?.map(entry => ({
        ...entry,
        display_name: employeeMap.get(entry.employee_name) || entry.employee_name,
        total_card_amount_flat: Math.round(entry.total_card_amount_flat || 0)
      }));
      
      return processedData || [];
    }
  });

  // Payroll Summary Report with automatic morning/night hours calculation
  const { data: payrollSummary } = useQuery({
    queryKey: ['payroll-summary', dateRange, wageSettings],
    queryFn: async () => {
      if (!wageSettings) return [];

      // First get all employees to create a mapping
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('staff_id, full_name');

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        throw employeesError;
      }

      // Create a map of staff_id to full_name
      const employeeMap = new Map();
      employeesData?.forEach(emp => {
        employeeMap.set(emp.staff_id, emp.full_name);
      });

      // Now get timesheet entries
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select(`
          employee_name,
          total_hours,
          total_card_amount_flat,
          total_card_amount_split,
          morning_hours,
          night_hours,
          clock_in_date,
          clock_in_time,
          clock_out_date,
          clock_out_time
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) {
        console.error('Error fetching payroll summary:', error);
        throw error;
      }
      
      const processedData = data?.map(entry => {
        let morningHours = entry.morning_hours || 0;
        let nightHours = entry.night_hours || 0;

        if ((!entry.morning_hours && !entry.night_hours) || (entry.morning_hours === 0 && entry.night_hours === 0)) {
          const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
          const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
          
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
          
          const nightStart = new Date(baseDate);
          const [nightStartHour, nightStartMin] = wageSettings.night_start_time.split(':');
          nightStart.setHours(parseInt(nightStartHour), parseInt(nightStartMin), 0, 0);
          
          const nightEnd = new Date(baseDate);
          const [nightEndHour, nightEndMin] = wageSettings.night_end_time.split(':');
          nightEnd.setHours(parseInt(nightEndHour), parseInt(nightEndMin), 0, 0);
          
          if (nightEnd <= nightStart) {
            nightEnd.setDate(nightEnd.getDate() + 1);
          }

          const morningOverlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
          const morningOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
          
          if (morningOverlapEnd > morningOverlapStart) {
            morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
          }

          const nightOverlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
          const nightOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
          
          if (nightOverlapEnd > nightOverlapStart) {
            nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
          }

          const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
          const calculatedTotal = morningHours + nightHours;
          
          if (calculatedTotal > totalWorkedHours) {
            const ratio = totalWorkedHours / calculatedTotal;
            morningHours *= ratio;
            nightHours *= ratio;
          }
        }

        return {
          ...entry,
          display_name: employeeMap.get(entry.employee_name) || entry.employee_name,
          calculated_morning_hours: Math.max(0, morningHours),
          calculated_night_hours: Math.max(0, nightHours)
        };
      });

      const grouped = processedData?.reduce((acc: any, entry) => {
        const name = entry.display_name;
        if (!acc[name]) {
          acc[name] = {
            employee_name: name,
            total_hours: 0,
            total_amount: 0,
            total_split_amount: 0,
            shifts: 0,
            morning_hours: 0,
            night_hours: 0
          };
        }
        acc[name].total_hours += entry.total_hours || 0;
        acc[name].total_amount += Math.round(entry.total_card_amount_flat || 0);
        acc[name].total_split_amount += Math.round(entry.total_card_amount_split || 0);
        acc[name].morning_hours += entry.calculated_morning_hours || 0;
        acc[name].night_hours += entry.calculated_night_hours || 0;
        acc[name].shifts += 1;
        return acc;
      }, {});
      
      return Object.values(grouped || {});
    },
    enabled: !!wageSettings
  });

  const exportReport = (type: string, exportFormat: 'csv' | 'excel' = 'csv') => {
    let data: any[] = [];
    let headers: string[] = [];
    let fileName = '';
    
    if (type === 'attendance' && attendanceReport) {
      headers = ['Employee Name', 'Date', 'Total Hours', 'Amount'];
      data = attendanceReport.map(row => {
        const employeeName = (row as any).display_name || row.employee_name;
        return [employeeName, row.clock_in_date, row.total_hours, Math.round(row.total_card_amount_flat)];
      });
      fileName = `attendance-report-${exportFormat === 'csv' ? 'csv' : 'xlsx'}`;
    } else if (type === 'payroll' && payrollSummary) {
      headers = ['Employee Name', 'Total Hours', 'Morning Hours', 'Night Hours', 'Total Amount', 'Shifts'];
      data = payrollSummary.map((row: any) => [
        row.employee_name,
        row.total_hours,
        row.morning_hours,
        row.night_hours,
        Math.round(row.total_split_amount),
        row.shifts
      ]);
      fileName = `payroll-report-${exportFormat === 'csv' ? 'csv' : 'xlsx'}`;
    }
    
    if (exportFormat === 'excel') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'attendance' ? 'Attendance' : 'Payroll');
      XLSX.writeFile(wb, `${fileName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } else {
      let csvContent = headers.join(',') + '\n';
      data.forEach(row => {
        csvContent += row.join(',') + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          console.log('Imported Excel data:', jsonData);
          toast.success('Excel file imported successfully!');
        } else if (file.name.endsWith('.csv')) {
          const csvData = data as string;
          const rows = csvData.split('\n').map(row => row.split(','));
          console.log('Imported CSV data:', rows);
          toast.success('CSV file imported successfully!');
        }
      } catch (error) {
        console.error('Error importing file:', error);
        toast.error('Failed to import file');
      }
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate and export attendance and payroll reports
          </p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-6">
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          payPeriodEndDay={28}
          onPayPeriodEndDayChange={() => {}}
        />
      </div>

      <MobileDropdownTabs
        defaultValue="attendance"
        tabs={[
          {
            value: "attendance",
            label: "Attendance Report",
            content: (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">
                  Attendance Report
                </CardTitle>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => exportReport('attendance', 'csv')} size="sm" className="shadow-md hover:shadow-lg transition-all duration-200">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={() => exportReport('attendance', 'excel')} size="sm" variant="outline" className="shadow-md hover:shadow-lg transition-all duration-200">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-left">
                        Employee
                      </TableHead>
                      <TableHead className="font-semibold text-left">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-left">
                        Hours
                      </TableHead>
                      <TableHead className="font-semibold text-left">
                        Amount (LE)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {attendanceReport?.map((entry, index) => {
                      const employeeName = (entry as any).display_name || entry.employee_name;
                      return (
                        <TableRow key={index} className="hover:bg-muted/20 transition-colors duration-150">
                          <TableCell className="font-medium">
                            {employeeName}
                          </TableCell>
                          <TableCell>{entry.clock_in_date}</TableCell>
                          <TableCell>{entry.total_hours?.toFixed(2)}</TableCell>
                          <TableCell>{Math.round(entry.total_card_amount_flat || 0)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
            )
          },
          {
            value: "payroll",
            label: "Payroll Summary",
            content: (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">
                  Payroll Summary
                </CardTitle>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => exportReport('payroll', 'csv')} size="sm" className="shadow-md hover:shadow-lg transition-all duration-200">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={() => exportReport('payroll', 'excel')} size="sm" variant="outline" className="shadow-md hover:shadow-lg transition-all duration-200">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Summary Section */}
              {payrollSummary && payrollSummary.length > 0 && (
                <div className="p-6 border-b border-border/50 bg-muted/20">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Period Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card rounded-lg p-4 border border-border/50 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Employees</div>
                      <div className="text-2xl font-bold text-primary">
                        {payrollSummary.length}
                      </div>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border/50 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Morning Hours</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {Number(payrollSummary.reduce((sum: number, emp: any) => sum + (emp.morning_hours || 0), 0)).toFixed(1)}h
                      </div>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border/50 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Night Hours</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {Number(payrollSummary.reduce((sum: number, emp: any) => sum + (emp.night_hours || 0), 0)).toFixed(1)}h
                      </div>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border/50 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Pay Amount</div>
                      <div className="text-2xl font-bold text-green-600">
                        LE {payrollSummary.reduce((sum: number, emp: any) => sum + (emp.total_split_amount || 0), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-left">Employee</TableHead>
                      <TableHead className="font-semibold text-left">Total Hours</TableHead>
                      <TableHead className="font-semibold text-left">Morning Hours</TableHead>
                      <TableHead className="font-semibold text-left">Night Hours</TableHead>
                      <TableHead className="font-semibold text-left">Shifts</TableHead>
                      <TableHead className="font-semibold text-left">Total Amount (LE)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollSummary?.map((summary: any, index) => (
                      <TableRow key={index} className="hover:bg-muted/20 transition-colors duration-150">
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
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
              <div className="flex items-center space-x-3">
                <Upload className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Import Data</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
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
    </div>
  );
};

export default ReportsPage;
