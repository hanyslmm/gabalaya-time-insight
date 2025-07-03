
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Download, FileBarChart, Users } from 'lucide-react';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import { format } from 'date-fns';

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

  // Employee Attendance Report
  const { data: attendanceReport } = useQuery({
    queryKey: ['attendance-report', dateRange],
    queryFn: async () => {
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
      
      if (error) throw error;
      return data || [];
    }
  });

  // Payroll Summary Report with automatic morning/night hours calculation
  const { data: payrollSummary } = useQuery({
    queryKey: ['payroll-summary', dateRange, wageSettings],
    queryFn: async () => {
      if (!wageSettings) return [];

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
          clock_out_time,
          employees (
            morning_wage_rate,
            night_wage_rate
          )
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Calculate morning and night hours for each entry if not already calculated
      const processedData = data?.map(entry => {
        let morningHours = entry.morning_hours || 0;
        let nightHours = entry.night_hours || 0;

        // If morning_hours and night_hours are not set, calculate them
        if ((!entry.morning_hours && !entry.night_hours) || (entry.morning_hours === 0 && entry.night_hours === 0)) {
          const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
          const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
          
          // Handle next day scenario for night shifts
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
          
          // Handle next day for night end time if it's earlier than night start
          if (nightEnd <= nightStart) {
            nightEnd.setDate(nightEnd.getDate() + 1);
          }

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
        }

        return {
          ...entry,
          calculated_morning_hours: Math.max(0, morningHours),
          calculated_night_hours: Math.max(0, nightHours)
        };
      });

      // Group by employee
      const grouped = processedData?.reduce((acc: any, entry) => {
        const name = entry.employee_name;
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
        acc[name].total_amount += entry.total_card_amount_flat || 0;
        acc[name].total_split_amount += entry.total_card_amount_split || 0;
        acc[name].morning_hours += entry.calculated_morning_hours || 0;
        acc[name].night_hours += entry.calculated_night_hours || 0;
        acc[name].shifts += 1;
        return acc;
      }, {});
      
      return Object.values(grouped || {});
    },
    enabled: !!wageSettings
  });

  const exportReport = (type: string) => {
    // Simple CSV export functionality
    let csvContent = '';
    let data: any[] = [];
    
    if (type === 'attendance' && attendanceReport) {
      csvContent = 'Employee Name,Date,Total Hours,Amount\n';
      data = attendanceReport;
      data.forEach(row => {
        csvContent += `${row.employee_name},${row.clock_in_date},${row.total_hours},${row.total_card_amount_flat}\n`;
      });
    } else if (type === 'payroll' && payrollSummary) {
      csvContent = 'Employee Name,Total Hours,Morning Hours,Night Hours,Total Amount,Split Amount,Shifts\n';
      data = payrollSummary;
      data.forEach((row: any) => {
        csvContent += `${row.employee_name},${row.total_hours},${row.morning_hours},${row.night_hours},${row.total_amount},${row.total_split_amount},${row.shifts}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports') || 'Reports'}</h1>
          <p className="mt-2 text-sm text-gray-600">Generate and export attendance and payroll reports</p>
        </div>
      </div>

      {/* Date Filter */}
      <TimesheetDateFilter
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        payPeriodEndDay={28}
        onPayPeriodEndDayChange={() => {}}
      />

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">Attendance Report</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Attendance Report</span>
                </CardTitle>
              </div>
              <Button onClick={() => exportReport('attendance')} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">Employee</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Hours</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Amount (LE)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceReport?.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{entry.employee_name}</td>
                        <td className="border border-gray-300 px-4 py-2">{entry.clock_in_date}</td>
                        <td className="border border-gray-300 px-4 py-2">{entry.total_hours?.toFixed(2)}</td>
                        <td className="border border-gray-300 px-4 py-2">{entry.total_card_amount_flat?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Payroll Summary</span>
                </CardTitle>
              </div>
              <Button onClick={() => exportReport('payroll')} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">Employee</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Total Hours</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Morning Hours</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Night Hours</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Shifts</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Flat Amount (LE)</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Split Amount (LE)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollSummary?.map((summary: any, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{summary.employee_name}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.total_hours?.toFixed(2)}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.morning_hours?.toFixed(2)}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.night_hours?.toFixed(2)}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.shifts}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.total_amount?.toFixed(2)}</td>
                        <td className="border border-gray-300 px-4 py-2">{summary.total_split_amount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
