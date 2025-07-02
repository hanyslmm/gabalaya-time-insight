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

  // Payroll Summary Report
  const { data: payrollSummary } = useQuery({
    queryKey: ['payroll-summary', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select(`
          employee_name,
          total_hours,
          total_card_amount_flat,
          morning_hours,
          night_hours
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Group by employee
      const grouped = data?.reduce((acc: any, entry) => {
        const name = entry.employee_name;
        if (!acc[name]) {
          acc[name] = {
            employee_name: name,
            total_hours: 0,
            total_amount: 0,
            shifts: 0,
            morning_hours: 0,
            night_hours: 0
          };
        }
        acc[name].total_hours += entry.total_hours || 0;
        acc[name].total_amount += entry.total_card_amount_flat || 0;
        acc[name].morning_hours += entry.morning_hours || 0;
        acc[name].night_hours += entry.night_hours || 0;
        acc[name].shifts += 1;
        return acc;
      }, {});
      
      return Object.values(grouped || {});
    }
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
      csvContent = 'Employee Name,Total Hours,Morning Hours,Night Hours,Total Amount,Shifts\n';
      data = payrollSummary;
      data.forEach((row: any) => {
        csvContent += `${row.employee_name},${row.total_hours},${row.morning_hours},${row.night_hours},${row.total_amount},${row.shifts}\n`;
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
                      <th className="border border-gray-300 px-4 py-2 text-left">Total Amount (LE)</th>
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