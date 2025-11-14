import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { usePayPeriodSettings } from '@/hooks/usePayPeriodSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const { calculatePayPeriod, mode, endDay, isLoading: settingsLoading } = usePayPeriodSettings();
  const [selectedRole, setSelectedRole] = useState<string>('all');
  
  // Date range state - default to current pay period from settings
  const [dateRange, setDateRange] = useState<DateRange>(() => calculatePayPeriod(0));
  
  // Recalculate on settings change (mode/endDay)
  React.useEffect(() => {
    const newRange = calculatePayPeriod(0);
    setDateRange(newRange);
  }, [mode, endDay]);
  
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  console.log('ReportsPage: User:', user?.username, 'Org:', activeOrganizationId);
  
  // Query 1: Employees (with wage rates and roles)
  const { data: employees, isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ['employees-final', activeOrganizationId],
    queryFn: async (): Promise<any[]> => {
      let q = supabase.from('employees').select('id, staff_id, full_name, role, morning_wage_rate, night_wage_rate');
      if (activeOrganizationId) q = q.eq('organization_id', activeOrganizationId);
      const { data, error } = await q;
      if (error) throw error;
      console.log('📊 ReportsPage: Loaded employees with wage rates and roles:', data);
      return data || [];
    }
  });
  
  // Query for available roles
  const { data: availableRoles = [] } = useQuery({
    queryKey: ['employee-roles', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_roles')
        .select('name')
        .eq('organization_id', activeOrganizationId)
        .order('name');
      
      if (error) {
        console.error('Failed to fetch roles:', error);
        return [];
      }
      
      // Add system roles
      const allRoles = [
        ...(data || []).map((r: any) => r.name),
        'Employee', 'admin', 'owner'
      ].filter((role, index, self) => self.indexOf(role) === index);
      
      return allRoles;
    }
  });

  // Query 2: Wage Settings
  const { data: wageSettings, isLoading: wageLoading } = useQuery({
    queryKey: ['wage-settings-final', activeOrganizationId],
    queryFn: async (): Promise<any> => {
      if (activeOrganizationId) {
        const query: any = (supabase as any)
          .from('wage_settings')
          .select('*')
          .eq('organization_id', activeOrganizationId);
        
        const { data } = await query.maybeSingle();
        if (data) return data;
      }
      return {
        morning_start_time: '06:00:00',
        morning_end_time: '17:00:00',
        night_start_time: '17:00:00',
        night_end_time: '06:00:00',
        morning_wage_rate: 17.0,
        night_wage_rate: 20.0,
        default_flat_wage_rate: 20.0,
      };
    }
  });

  // Query 2.5: Working Hours Window Settings
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

  // Query 3: Timesheet Data (with legacy support like TimesheetsPage)
  const { data: rawTimesheetData, isLoading: timesheetLoading, error: timesheetError } = useQuery({
    queryKey: ['timesheet-final', dateRange, activeOrganizationId, employees?.length, mode, endDay],
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

      // Combine current-org rows with safe legacy rows (null org but employee belongs to this org)
      const resOrg = await queryOrg;
      if (resOrg.error) throw resOrg.error;

      let legacyData: any[] = [];
      if (employeeIds.length > 0) {
        const resLegacy = await queryLegacy;
        if (resLegacy.error) {
          console.warn('ReportsPage: legacy query error (ignored):', resLegacy.error);
        } else {
          legacyData = resLegacy.data || [];
        }
      }

      return [ ...(resOrg.data || []), ...legacyData ];
    },
    enabled: !!(dateRange?.from && dateRange?.to && employees !== undefined)
  });

  // Process attendance report with role filtering
  const attendanceReport = useMemo(() => {
    if (!rawTimesheetData || !employees || !wageSettings) return [];
    
      const employeeMap = new Map();
      const employeeRoleMap = new Map(); // Map employee name/id to their role
      const employeeWageMap = new Map(); // Map employee name/id to their wage rates
      
      employees.forEach(emp => {
        if (emp.staff_id) {
          employeeMap.set(emp.staff_id, emp.full_name);
          employeeRoleMap.set(emp.staff_id, emp.role);
          employeeWageMap.set(emp.staff_id, {
            morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
            night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
          });
        }
        if (emp.full_name) {
          employeeMap.set(emp.full_name, emp.full_name);
          employeeRoleMap.set(emp.full_name, emp.role);
          employeeWageMap.set(emp.full_name, {
            morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
            night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
          });
        }
        if (emp.id) {
          employeeMap.set(emp.id, emp.full_name);
          employeeRoleMap.set(emp.id, emp.role);
          employeeWageMap.set(emp.id, {
            morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
            night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
          });
        }
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
      
      // Apply role filter
      if (selectedRole !== 'all' && hasValidEmployee) {
        const employeeRole = employeeRoleMap.get(entry.employee_name) || 
                            employeeRoleMap.get(entry.employee_id) ||
                            employees.find(emp => 
                              emp.full_name === entry.employee_name ||
                              emp.staff_id === entry.employee_name ||
                              emp.id === entry.employee_id
                            )?.role;
        
        if (employeeRole !== selectedRole) {
          return false;
        }
      }
      
      return hasValidEmployee;
    }).map(entry => {
        let morningHours = entry.morning_hours || 0;
        let nightHours = entry.night_hours || 0;
        // Use the original total_hours from database (same as MyTimesheetPage)
        let totalHours = entry.total_hours || 0;

        // Only recalculate morning/night split if not already stored, but preserve original total_hours
        if (entry.clock_in_time && entry.clock_out_time && (morningHours === 0 && nightHours === 0)) {
          const clean = (t: string) => (t || '00:00:00').split('.')[0];
          const toMinutes = (t: string) => {
            const [h, m, s] = clean(t).split(':').map((v) => parseInt(v, 10) || 0);
            return (h % 24) * 60 + (m % 60) + Math.floor((s % 60) / 60);
          };
          const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
            const start = Math.max(aStart, bStart);
            const end = Math.min(aEnd, bEnd);
            return Math.max(0, end - start);
          };

          let shiftStart = toMinutes(entry.clock_in_time);
          let shiftEnd = toMinutes(entry.clock_out_time);
          if (shiftEnd < shiftStart) shiftEnd += 24 * 60;

          // Morning: 6 AM (360 min) to 5 PM (1020 min)
          const morningStart = 360; // 6 AM
          const morningEnd = 1020; // 5 PM
          const morningMinutes = overlap(shiftStart, shiftEnd, morningStart, morningEnd);

          // Night: 5 PM (1020 min) to 6 AM next day (1440 min + 360 min)
          const nightStart = 1020; // 5 PM
          const nightEnd = 1440 + 360; // 6 AM next day
          const nightMinutes = overlap(shiftStart, shiftEnd, nightStart, nightEnd);

          morningHours = Math.max(0, parseFloat((morningMinutes / 60).toFixed(2)));
          nightHours = Math.max(0, parseFloat((nightMinutes / 60).toFixed(2)));
          // DO NOT overwrite totalHours - keep the original database value
        } else if (morningHours === 0 && nightHours === 0 && totalHours > 0) {
          morningHours = totalHours;
        }

        const displayName = employeeMap.get(entry.employee_name) || 
                           employeeMap.get(entry.employee_id) || 
                           entry.employee_name || 'Unknown Employee';

      // Calculate amount for individual entries using EMPLOYEE-SPECIFIC wage rates
      const storedAmount = entry.total_card_amount_split || entry.total_card_amount_flat || 0;
      let calculatedAmount = 0;
      
      if (storedAmount > 0) {
        calculatedAmount = storedAmount;
      } else {
        // Get employee-specific wage rates (fallback to global rates)
        const employeeWages = employeeWageMap.get(entry.employee_name) || 
                             employeeWageMap.get(entry.employee_id) || 
                             employeeWageMap.get(displayName) || 
                             { morning: wageSettings?.morning_wage_rate || 17, night: wageSettings?.night_wage_rate || 20 };
        
        const morningRate = employeeWages.morning;
        const nightRate = employeeWages.night;
        
        console.log(`💰 Calculating for ${displayName}: morning=${morningRate}, night=${nightRate}`);
        
        if (morningHours > 0 || nightHours > 0) {
          // Use split calculation
          calculatedAmount = (morningHours * morningRate) + (nightHours * nightRate);
        } else if (totalHours > 0) {
          // Use flat rate for total hours
          calculatedAmount = totalHours * morningRate;
        }
      }

        return {
          ...entry,
          display_name: displayName,
          total_hours: morningHours + nightHours, // Use calculated total (morning + night) for consistency
          calculated_morning_hours: Math.max(0, morningHours),
          calculated_night_hours: Math.max(0, nightHours),
        total_card_amount_flat: Math.round(calculatedAmount),
        calculated_amount: Math.round(calculatedAmount)
        };
      });
  }, [rawTimesheetData, employees, wageSettings, workingHoursSettings, selectedRole]);

  // Calculate payroll summary - using employee-specific rates from attendanceReport
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
        
        // Use the already-calculated amount from attendanceReport 
        // (which already uses employee-specific wage rates)
        const calculatedAmount = entry.calculated_amount || 0;
        
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
        toast.error(t('noDataToExport'));
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const cols = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, 12)
      }));
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type === 'attendance' ? t('attendanceReportLabel') : t('payrollSummaryLabel'));
      
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
        <MobileHeader title={t('reports')} subtitle={t('loading')} />
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
        <MobileHeader title={t('reports')} subtitle={t('errorLoadingData')} />
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{t('failedToLoadReports')}</p>
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
        title={t('reports')} 
        subtitle={currentView === 'overview' ? `${attendanceReport.length} ${t('entries')} • ${formatDateRange()}` : ''}
      />

      <MobileSection>
        <TimesheetDateFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          payPeriodEndDay={endDay}
          onPayPeriodEndDayChange={() => {}} // Read-only, configured in Settings
          payPeriodMode={mode}
        />
        
        {/* Role Filter */}
        <div className="mt-4 bg-card rounded-lg border p-4">
          <div className="space-y-2">
            <Label>{t('filterByRole')}</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('allRoles')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allRoles')}</SelectItem>
                {availableRoles.map((role: string) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </MobileSection>

      <MobileSection>
        {currentView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('totalHours')}</p>
                      <p className="text-2xl font-bold text-foreground">{keyMetrics.totalHours.toFixed(1)}h</p>
                    </div>
                    <Clock className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('totalShifts')}</p>
                      <p className="text-2xl font-bold text-foreground">{keyMetrics.totalShifts}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('employees')}</p>
                      <p className="text-2xl font-bold text-foreground">{keyMetrics.totalEmployees}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('totalAmount')}</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{keyMetrics.totalAmount.toFixed(0)} LE</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('quickActions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="justify-between h-auto p-4"
                    onClick={() => setCurrentView('attendance')}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{t('viewAttendance')}</p>
                        <p className="text-sm text-muted-foreground">{t('detailedTimesheetRecords')}</p>
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
                      <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div className="text-left">
                        <p className="font-medium">{t('payrollSummary')}</p>
                        <p className="text-sm text-muted-foreground">{t('employeeWageCalculations')}</p>
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
                        <p className="font-medium">{t('analytics')}</p>
                        <p className="text-sm text-muted-foreground">{t('chartsAndInsights')}</p>
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
                  <CardTitle className="text-lg">{t('recentActivity')}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setCurrentView('attendance')}
                  >
                    {t('viewAll')} <ChevronRight className="h-4 w-4 ml-1" />
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
                          <Badge variant="secondary" className="text-xs font-medium text-green-600 dark:text-green-400">
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
                    {t('back')}
                  </Button>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('attendanceReport')}
                </CardTitle>
                </div>
                <Button
                  onClick={() => exportReport('attendance')}
                  variant="outline"
                  size="sm"
                  disabled={attendanceReport.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('exportTimesheet')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attendanceReport.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t('noDataFound')}</h3>
                  <p className="text-muted-foreground mb-4">{t('noTimesheetEntriesFound')} {formatDateRange()}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('tryExpandingDateRange')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('hiringDate')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('clockIn')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('clockOut')}</TableHead>
                        <TableHead>{t('hours')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('morning')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('night')}</TableHead>
                        <TableHead>{t('amount')}</TableHead>
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
                          <TableCell className="font-medium text-green-600 dark:text-green-400">{entry.calculated_amount || entry.total_card_amount_flat || 0} LE</TableCell>
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
                    {t('back')}
                  </Button>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {t('payrollSummary')}
                </CardTitle>
                </div>
                <Button
                  onClick={() => exportReport('payroll')}
                  variant="outline"
                  size="sm"
                  disabled={payrollSummary.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('exportTimesheet')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {payrollSummary.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t('noPayrollData')}</h3>
                  <p className="text-muted-foreground">{t('noPayrollDataAvailable')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('totalHours')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('morning')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('night')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('shifts')}</TableHead>
                        <TableHead>{t('amount')}</TableHead>
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
                          <TableCell className="font-bold text-green-600 dark:text-green-400">{Math.round(summary.total_split_amount || summary.total_flat_amount || 0)} LE</TableCell>
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
                {t('back')}
              </Button>
              <h2 className="text-xl font-semibold">{t('analyticsDashboard')}</h2>
            </div>
          <HRAnalytics dateRange={dateRange} />
                    </div>
        )}
      </MobileSection>
    </MobilePageWrapper>
  );
};

export default ReportsPage;
