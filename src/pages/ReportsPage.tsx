import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Users, FileSpreadsheet, ChevronRight, AlertCircle, Calendar, Clock, TrendingUp, DollarSign } from 'lucide-react';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import { HRAnalytics } from '@/components/HRAnalytics';
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

type ViewType = 'overview' | 'attendance' | 'payroll' | 'analytics';

const ReportsPage: React.FC = () => {
  console.log('ReportsPage: Component rendering...');
  
  // Hooks at top level
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);
    return { from: sixMonthsAgo, to: today };
  });
  
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  console.log('ReportsPage: User:', user?.username, 'Org:', activeOrganizationId);
  
  // Query 1: Employees
  const { data: employees, isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ['employees-final', activeOrganizationId],
    queryFn: async (): Promise<any[]> => {
      let q = supabase.from('employees').select('id, staff_id, full_name');
      if (activeOrganizationId) q = q.eq('organization_id', activeOrganizationId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  });

  // Query 2: Wage Settings
  const { data: wageSettings, isLoading: wageLoading } = useQuery({
    queryKey: ['wage-settings-final', activeOrganizationId],
    queryFn: async (): Promise<any> => {
      if (activeOrganizationId) {
        const { data } = await supabase
          .from('wage_settings')
          .select('*')
          .eq('organization_id', activeOrganizationId)
          .maybeSingle();
        if (data) return data;
      }
      return {
        morning_start_time: '08:00:00',
        morning_end_time: '17:00:00',
        night_start_time: '17:00:00',
        night_end_time: '01:00:00',
        morning_wage_rate: 17.0,
        night_wage_rate: 20.0,
        default_flat_wage_rate: 20.0,
      };
    }
  });

  // Query 3: Timesheet Data (with legacy support like TimesheetsPage)
  const { data: rawTimesheetData, isLoading: timesheetLoading, error: timesheetError } = useQuery({
    queryKey: ['timesheet-final', dateRange, activeOrganizationId, employees?.length],
    queryFn: async (): Promise<any[]> => {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
      const applyDateFilter = (q: any) => {
        return q
          .gte('clock_in_date', fromDate)
          .lte('clock_in_date', toDate)
          .order('clock_in_date', { ascending: false });
      };

      if (!activeOrganizationId) {
        // No organization - get all data
        let query = supabase.from('timesheet_entries').select('*');
        query = applyDateFilter(query);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }

      // Build employee matching for legacy rows (organization_id is null)
      const employeeIds = employees?.map(e => e.id) || [];
      const employeeStaffIds = employees?.map(e => e.staff_id).filter(Boolean) || [];
      const employeeNames = employees?.map(e => e.full_name).filter(Boolean) || [];

      // Query A: organization-specific timesheet entries
      let queryOrg = supabase
        .from('timesheet_entries')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      queryOrg = applyDateFilter(queryOrg);

      // Query B: legacy rows with null organization, matched to org employees
      let queryLegacy = supabase
        .from('timesheet_entries')
        .select('*')
        .is('organization_id', null);
      queryLegacy = applyDateFilter(queryLegacy);
      
      if (employeeIds.length > 0) {
        queryLegacy = queryLegacy.in('employee_id', employeeIds);
      } else if (employeeStaffIds.length > 0 || employeeNames.length > 0) {
        const orParts: string[] = [];
        if (employeeStaffIds.length > 0) {
          const staffVals = employeeStaffIds.map((v: string) => `"${v}"`).join(',');
          orParts.push(`employee_name.in.(${staffVals})`);
        }
        if (employeeNames.length > 0) {
          const nameVals = employeeNames.map((v: string) => `"${v}"`).join(',');
          orParts.push(`employee_name.in.(${nameVals})`);
        }
        if (orParts.length > 0) {
          queryLegacy = queryLegacy.or(orParts.join(','));
        }
      }

      const [resOrg, resLegacy] = await Promise.all([queryOrg, queryLegacy]);
      
      if (resOrg.error) throw resOrg.error;
      if (resLegacy.error) throw resLegacy.error;

      // Combine and sort
      const combined = [...(resOrg.data || []), ...(resLegacy.data || [])];
      combined.sort((a, b) => (a.clock_in_date < b.clock_in_date ? 1 : -1));
      return combined.slice(0, 500); // Cap to 500 entries for performance
    },
    enabled: !!(dateRange?.from && dateRange?.to && employees !== undefined)
  });

  // Process attendance report
  const attendanceReport = useMemo(() => {
    if (!rawTimesheetData || !employees || !wageSettings) return [];
    
      const employeeMap = new Map();
      employees.forEach(emp => {
        if (emp.staff_id) employeeMap.set(emp.staff_id, emp.full_name);
        if (emp.full_name) employeeMap.set(emp.full_name, emp.full_name);
        if (emp.id) employeeMap.set(emp.id, emp.full_name);
      });

    return rawTimesheetData.filter(entry => {
      // Only include entries for employees that actually exist in the current organization
      const hasValidEmployee = employeeMap.has(entry.employee_name) || 
                               employeeMap.has(entry.employee_id) || 
                               employees.some(emp => 
                                 emp.full_name === entry.employee_name ||
                                 emp.staff_id === entry.employee_name ||
                                 emp.id === entry.employee_id
                               );
      return hasValidEmployee;
    }).map(entry => {
        let morningHours = entry.morning_hours || 0;
        const nightHours = entry.night_hours || 0;

        if (morningHours === 0 && nightHours === 0 && entry.total_hours > 0) {
          morningHours = entry.total_hours;
        }

        const displayName = employeeMap.get(entry.employee_name) || 
                           employeeMap.get(entry.employee_id) || 
                           entry.employee_name || 'Unknown Employee';

      // Calculate amount for individual entries (same logic as payroll summary)
      const storedAmount = entry.total_card_amount_split || entry.total_card_amount_flat || 0;
      let calculatedAmount = 0;
      
      if (storedAmount > 0) {
        calculatedAmount = storedAmount;
      } else {
        // Calculate from hours and wage rates
        const morningRate = wageSettings?.morning_wage_rate || 17;
        const nightRate = wageSettings?.night_wage_rate || 20;
        
        if (morningHours > 0 || nightHours > 0) {
          // Use split calculation
          calculatedAmount = (morningHours * morningRate) + (nightHours * nightRate);
        } else if ((entry.total_hours || 0) > 0) {
          // Use flat rate for total hours
          calculatedAmount = (entry.total_hours || 0) * morningRate;
        }
      }

        return {
          ...entry,
          display_name: displayName,
          calculated_morning_hours: Math.max(0, morningHours),
          calculated_night_hours: Math.max(0, nightHours),
        total_card_amount_flat: Math.round(calculatedAmount),
        calculated_amount: Math.round(calculatedAmount)
        };
      });
  }, [rawTimesheetData, employees, wageSettings]);

  // Calculate payroll summary
  const payrollSummary = useMemo(() => {
    if (!attendanceReport.length) return [];
    
      const grouped = attendanceReport.reduce((acc, entry) => {
        const key = entry.display_name || entry.employee_name || 'Unknown';
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
        
        // Calculate amount if not stored in database
        const storedAmount = entry.total_card_amount_split || entry.total_card_amount_flat || 0;
        let calculatedAmount = 0;
        
        if (storedAmount > 0) {
          calculatedAmount = storedAmount;
        } else {
          // Calculate from hours and wage rates
          const morningHours = entry.calculated_morning_hours || 0;
          const nightHours = entry.calculated_night_hours || 0;
          const totalHours = entry.total_hours || 0;
          
          const morningRate = wageSettings?.morning_wage_rate || 17;
          const nightRate = wageSettings?.night_wage_rate || 20;
          
          if (morningHours > 0 || nightHours > 0) {
            // Use split calculation
            calculatedAmount = (morningHours * morningRate) + (nightHours * nightRate);
          } else if (totalHours > 0) {
            // Use flat rate for total hours
            calculatedAmount = totalHours * morningRate;
          }
        }
        
        acc[key].total_flat_amount += calculatedAmount;
        acc[key].total_split_amount += calculatedAmount;

        return acc;
      }, {} as any);

    return Object.values(grouped);
  }, [attendanceReport]);

  // Key metrics
  const keyMetrics = useMemo(() => {
    const totalHours = attendanceReport.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
    const totalAmount = attendanceReport.reduce((sum, entry) => sum + (entry.calculated_amount || entry.total_card_amount_flat || 0), 0);
    const totalEmployees = new Set(attendanceReport.map(entry => entry.display_name)).size;
    
    return {
      totalShifts: attendanceReport.length,
      totalHours: totalHours,
      totalAmount: totalAmount,
      totalEmployees: totalEmployees,
      morningHours: attendanceReport.reduce((sum, entry) => sum + (entry.calculated_morning_hours || 0), 0),
      nightHours: attendanceReport.reduce((sum, entry) => sum + (entry.calculated_night_hours || 0), 0),
    };
  }, [attendanceReport]);

  // Export functionality
  const exportReport = (type: string) => {
    try {
      let data: any[] = [];
      let filename = '';

      if (type === 'attendance') {
        data = attendanceReport.map((entry, index) => ({
          '#': index + 1,
          'Employee Name': entry.display_name,
          'Date': entry.clock_in_date,
          'Clock In': entry.clock_in_time,
          'Clock Out': entry.clock_out_time || 'N/A',
          'Total Hours': Number(entry.total_hours || 0).toFixed(2),
          'Morning Hours': Number(entry.calculated_morning_hours || 0).toFixed(2),
          'Night Hours': Number(entry.calculated_night_hours || 0).toFixed(2),
          'Total Amount (LE)': Number(entry.calculated_amount || entry.total_card_amount_flat || 0).toFixed(2)
        }));
        filename = `Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      } else if (type === 'payroll') {
        data = payrollSummary.map((summary: any, index) => ({
          '#': index + 1,
          'Employee Name': summary.employee_name,
          'Total Hours': Number(summary.total_hours || 0).toFixed(2),
          'Morning Hours': Number(summary.morning_hours || 0).toFixed(2),
          'Night Hours': Number(summary.night_hours || 0).toFixed(2),
          'Total Shifts': summary.shifts,
          'Total Amount (LE)': Number(summary.total_split_amount || summary.total_flat_amount || 0).toFixed(2)
        }));
        filename = `Payroll_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      }

      if (data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const cols = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, 12)
      }));
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'attendance' ? 'Attendance Report' : 'Payroll Summary');
      
      XLSX.writeFile(wb, filename);
      toast.success(`${filename} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  const formatDateRange = () => {
    try {
      if (dateRange?.from && dateRange?.to) {
        return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
      }
      return 'Invalid date range';
    } catch (error) {
      return 'Invalid date range';
    }
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
  if (timesheetError || employeesError) {
    return (
      <MobilePageWrapper>
        <MobileHeader title="Reports" subtitle="Error loading data" />
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load reports data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </MobilePageWrapper>
    );
  }

  console.log('ReportsPage: Ready to render with', attendanceReport.length, 'entries');
  console.log('ReportsPage: Current org employees:', employees?.map(e => e.full_name) || []);
  console.log('ReportsPage: Attendance report employees:', [...new Set(attendanceReport.map(e => e.display_name))]);
  console.log('ReportsPage: Sample payroll with amounts:', payrollSummary.slice(0, 3).map((p: any) => ({
    name: p.employee_name,
    hours: p.total_hours,
    amount: p.total_split_amount || p.total_flat_amount
  })));

  return (
    <MobilePageWrapper>
      <MobileHeader 
        title="Reports" 
        subtitle={currentView === 'overview' ? `${attendanceReport.length} entries • ${formatDateRange()}` : ''}
      />

      <MobileSection>
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          payPeriodEndDay={28}
          onPayPeriodEndDayChange={() => {}}
        />
      </MobileSection>

      <MobileSection>
        {currentView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Total Hours</p>
                      <p className="text-2xl font-bold text-blue-900">{keyMetrics.totalHours.toFixed(1)}h</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">Total Shifts</p>
                      <p className="text-2xl font-bold text-green-900">{keyMetrics.totalShifts}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700">Employees</p>
                      <p className="text-2xl font-bold text-purple-900">{keyMetrics.totalEmployees}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-700">Total Amount</p>
                      <p className="text-2xl font-bold text-amber-900">{keyMetrics.totalAmount.toFixed(0)} LE</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="justify-between h-auto p-4"
                    onClick={() => setCurrentView('attendance')}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium">View Attendance</p>
                        <p className="text-sm text-muted-foreground">Detailed timesheet records</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-between h-auto p-4"
                    onClick={() => setCurrentView('payroll')}
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium">Payroll Summary</p>
                        <p className="text-sm text-muted-foreground">Employee wage calculations</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-between h-auto p-4"
                    onClick={() => setCurrentView('analytics')}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <div className="text-left">
                        <p className="font-medium">Analytics</p>
                        <p className="text-sm text-muted-foreground">Charts and insights</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Preview */}
            {attendanceReport.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setCurrentView('attendance')}
                  >
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {attendanceReport.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          <div>
                            <p className="font-medium">{entry.display_name}</p>
                            <p className="text-sm text-muted-foreground">{entry.clock_in_date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{entry.total_hours?.toFixed(1)}h</p>
                          <Badge variant="secondary" className="text-xs">
                            {entry.calculated_amount || entry.total_card_amount_flat || 0} LE
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentView === 'attendance' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentView('overview')}
                    className="mr-2"
                  >
                    ← Back
                  </Button>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Attendance Report
                </CardTitle>
                </div>
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
              {attendanceReport.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Data Found</h3>
                  <p className="text-muted-foreground mb-4">No timesheet entries found for {formatDateRange()}</p>
                  <p className="text-sm text-muted-foreground">
                    Try expanding the date range or check if employees have clocked in.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="hidden sm:table-cell">Clock In</TableHead>
                        <TableHead className="hidden sm:table-cell">Clock Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead className="hidden md:table-cell">Morning</TableHead>
                        <TableHead className="hidden md:table-cell">Night</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceReport.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{entry.display_name}</TableCell>
                          <TableCell>{format(new Date(entry.clock_in_date), 'MMM dd')}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{entry.clock_in_time}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{entry.clock_out_time || 'Active'}</TableCell>
                          <TableCell className="font-medium">{entry.total_hours?.toFixed(1) || '0.0'}h</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{entry.calculated_morning_hours?.toFixed(1) || '0.0'}h</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{entry.calculated_night_hours?.toFixed(1) || '0.0'}h</TableCell>
                          <TableCell className="font-medium">{entry.calculated_amount || entry.total_card_amount_flat || 0} LE</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'payroll' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentView('overview')}
                    className="mr-2"
                  >
                    ← Back
                  </Button>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Payroll Summary
                </CardTitle>
                </div>
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
                <div className="text-center py-12">
                  <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Payroll Data</h3>
                  <p className="text-muted-foreground">No payroll data available for the selected period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead className="hidden md:table-cell">Morning</TableHead>
                        <TableHead className="hidden md:table-cell">Night</TableHead>
                        <TableHead className="hidden sm:table-cell">Shifts</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollSummary.map((summary: any, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{summary.employee_name}</TableCell>
                          <TableCell className="font-medium">{summary.total_hours?.toFixed(1)}h</TableCell>
                          <TableCell className="hidden md:table-cell">{summary.morning_hours?.toFixed(1)}h</TableCell>
                          <TableCell className="hidden md:table-cell">{summary.night_hours?.toFixed(1)}h</TableCell>
                          <TableCell className="hidden sm:table-cell">{summary.shifts}</TableCell>
                          <TableCell className="font-bold text-green-600">{Math.round(summary.total_split_amount || summary.total_flat_amount || 0)} LE</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentView === 'analytics' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentView('overview')}
              >
                ← Back
              </Button>
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
            </div>
          <HRAnalytics dateRange={dateRange} />
                    </div>
        )}
      </MobileSection>
    </MobilePageWrapper>
  );
};

export default ReportsPage;
