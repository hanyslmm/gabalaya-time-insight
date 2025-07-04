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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DateRange {
  from: Date;
  to: Date;
}

const ReportsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
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

  // Employee Attendance Report - Fixed to properly display employee names by joining with employees table
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
          clock_out_date,
          employees!inner(full_name, staff_id)
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('clock_in_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching attendance report:', error);
        // Fallback to original query if join fails
        const { data: fallbackData, error: fallbackError } = await supabase
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
        
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      
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
          employees!inner(full_name, staff_id)
        `)
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) {
        console.error('Error fetching payroll summary:', error);
        // Fallback query
        const { data: fallbackData, error: fallbackError } = await supabase
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
        
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
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
          display_name: entry.employees?.full_name || entry.employee_name,
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
    let csvContent = '';
    let data: any[] = [];
    
    if (type === 'attendance' && attendanceReport) {
      csvContent = 'Employee Name,Date,Total Hours,Amount\n';
      data = attendanceReport;
      data.forEach(row => {
        const employeeName = (row as any).employees?.full_name || row.employee_name;
        csvContent += `${employeeName},${row.clock_in_date},${row.total_hours},${row.total_card_amount_flat}\n`;
      });
    } else if (type === 'payroll' && payrollSummary) {
      csvContent = 'Employee Name,Total Hours,Morning Hours,Night Hours,Total Amount,Shifts\n';
      data = payrollSummary;
      data.forEach((row: any) => {
        csvContent += `${row.employee_name},${row.total_hours},${row.morning_hours},${row.night_hours},${row.total_split_amount},${row.shifts}\n`;
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
    <div className={`px-4 sm:px-6 lg:px-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('reports') || 'Reports'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRTL ? 'إنشاء وتصدير تقارير الحضور والرواتب' : 'Generate and export attendance and payroll reports'}
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

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className={`grid w-full grid-cols-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <TabsTrigger value="attendance" className={`${isRTL ? 'font-arabic' : ''}`}>
            {isRTL ? 'تقرير الحضور' : 'Attendance Report'}
          </TabsTrigger>
          <TabsTrigger value="payroll" className={`${isRTL ? 'font-arabic' : ''}`}>
            {isRTL ? 'ملخص الرواتب' : 'Payroll Summary'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
            <CardHeader className={`flex flex-row items-center justify-between border-b border-border/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center space-x-3 ${isRTL ? 'space-x-reverse' : ''}`}>
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className={`text-xl ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? 'تقرير الحضور' : 'Attendance Report'}
                </CardTitle>
              </div>
              <Button onClick={() => exportReport('attendance')} size="sm" className="shadow-md hover:shadow-lg transition-all duration-200">
                <Download className="h-4 w-4 mr-2" />
                {isRTL ? 'تصدير CSV' : 'Export CSV'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'الموظف' : 'Employee'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'التاريخ' : 'Date'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'الساعات' : 'Hours'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'المبلغ (جنيه)' : 'Amount (LE)'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceReport?.map((entry, index) => {
                      const employeeName = (entry as any).employees?.full_name || entry.employee_name;
                      return (
                        <TableRow key={index} className="hover:bg-muted/20 transition-colors duration-150">
                          <TableCell className={`font-medium ${isRTL ? 'text-right font-arabic' : ''}`}>
                            {employeeName}
                          </TableCell>
                          <TableCell className={isRTL ? 'text-right' : ''}>{entry.clock_in_date}</TableCell>
                          <TableCell className={isRTL ? 'text-right' : ''}>{entry.total_hours?.toFixed(2)}</TableCell>
                          <TableCell className={isRTL ? 'text-right' : ''}>{entry.total_card_amount_flat?.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
            <CardHeader className={`flex flex-row items-center justify-between border-b border-border/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center space-x-3 ${isRTL ? 'space-x-reverse' : ''}`}>
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className={`text-xl ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? 'ملخص الرواتب' : 'Payroll Summary'}
                </CardTitle>
              </div>
              <Button onClick={() => exportReport('payroll')} size="sm" className="shadow-md hover:shadow-lg transition-all duration-200">
                <Download className="h-4 w-4 mr-2" />
                {isRTL ? 'تصدير CSV' : 'Export CSV'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'الموظف' : 'Employee'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'إجمالي الساعات' : 'Total Hours'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'ساعات الصباح' : 'Morning Hours'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'ساعات الليل' : 'Night Hours'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'الورديات' : 'Shifts'}
                      </TableHead>
                      <TableHead className={`font-semibold ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
                        {isRTL ? 'إجمالي المبلغ (جنيه)' : 'Total Amount (LE)'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollSummary?.map((summary: any, index) => (
                      <TableRow key={index} className="hover:bg-muted/20 transition-colors duration-150">
                        <TableCell className={`font-medium ${isRTL ? 'text-right font-arabic' : ''}`}>
                          {summary.employee_name}
                        </TableCell>
                        <TableCell className={isRTL ? 'text-right' : ''}>{summary.total_hours?.toFixed(2)}</TableCell>
                        <TableCell className={isRTL ? 'text-right' : ''}>{summary.morning_hours?.toFixed(2)}</TableCell>
                        <TableCell className={isRTL ? 'text-right' : ''}>{summary.night_hours?.toFixed(2)}</TableCell>
                        <TableCell className={isRTL ? 'text-right' : ''}>{summary.shifts}</TableCell>
                        <TableCell className={isRTL ? 'text-right' : ''}>{summary.total_split_amount?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
