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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Users, FileSpreadsheet, ChevronRight, AlertCircle, Calendar, Clock, TrendingUp, DollarSign, FileText, FileDown, Search, X, ArrowUp, ArrowDown } from 'lucide-react';
import TimesheetDateFilter from '@/components/TimesheetDateFilter';
import { HRAnalytics } from '@/components/HRAnalytics';
import { EmployeeMultiSelect } from '@/components/EmployeeMultiSelect';
import { exportToPDF, exportToCSV, exportToExcel, exportAttendanceReportToExcel } from '@/utils/reportExports';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
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
  const [currentView, setCurrentView] = useState<ViewType>('attendance');
  const { calculatePayPeriod, mode, endDay, isLoading: settingsLoading } = usePayPeriodSettings();
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [comparePeriod, setComparePeriod] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf'>('excel');
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [maxWorkingHours, setMaxWorkingHours] = useState<number>(6);
  const [highlightLongShifts, setHighlightLongShifts] = useState<boolean>(true);

  // Date range state - default to current pay period from settings
  const [dateRange, setDateRange] = useState<DateRange>(() => calculatePayPeriod(0));
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | null>(null);

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

  // Query 2.6: Points System Status and Organization Name
  const { data: pointsSystemData } = useQuery({
    queryKey: ['points-system-status', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('is_points_system_active, point_value, name')
        .eq('id', activeOrganizationId)
        .single();

      if (error) {
        console.error('Error fetching points system status:', error);
        return { isPointsSystemActive: false, pointValue: 5, organizationName: '' };
      }

      return {
        isPointsSystemActive: (data as any)?.is_points_system_active || false,
        pointValue: Number((data as any)?.point_value) || 5,
        organizationName: (data as any)?.name || ''
      };
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

      return [...(resOrg.data || []), ...legacyData];
    },
    enabled: !!(dateRange?.from && dateRange?.to && employees !== undefined)
  });

  // Process attendance report with advanced filtering
  const attendanceReport = useMemo(() => {
    if (!rawTimesheetData || !employees || !wageSettings) return [];

    const employeeMap = new Map();
    const employeeRoleMap = new Map(); // Map employee name/id to their role
    const employeeWageMap = new Map(); // Map employee name/id to their wage rates
    const employeeIdMap = new Map(); // Map employee name/id to their id

    employees.forEach(emp => {
      if (emp.staff_id) {
        employeeMap.set(emp.staff_id, emp.full_name);
        employeeRoleMap.set(emp.staff_id, emp.role);
        employeeIdMap.set(emp.staff_id, emp.id);
        employeeWageMap.set(emp.staff_id, {
          morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
          night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
        });
      }
      if (emp.full_name) {
        employeeMap.set(emp.full_name, emp.full_name);
        employeeRoleMap.set(emp.full_name, emp.role);
        employeeIdMap.set(emp.full_name, emp.id);
        employeeWageMap.set(emp.full_name, {
          morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
          night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
        });
      }
      if (emp.id) {
        employeeMap.set(emp.id, emp.full_name);
        employeeRoleMap.set(emp.id, emp.role);
        employeeIdMap.set(emp.id, emp.id);
        employeeWageMap.set(emp.id, {
          morning: emp.morning_wage_rate || wageSettings?.morning_wage_rate || 17,
          night: emp.night_wage_rate || wageSettings?.night_wage_rate || 20
        });
      }
    });

    return rawTimesheetData.filter(entry => {
      // Only include entries for employees that actually exist in the current organization
      const entryEmployeeId = employeeIdMap.get(entry.employee_name) ||
        employeeIdMap.get(entry.employee_id) ||
        employees.find(emp =>
          emp.full_name === entry.employee_name ||
          emp.staff_id === entry.employee_name ||
          emp.id === entry.employee_id
        )?.id;

      const hasValidEmployee = employeeMap.has(entry.employee_name) ||
        employeeMap.has(entry.employee_id) ||
        employees.some(emp =>
          emp.full_name === entry.employee_name ||
          emp.staff_id === entry.employee_name ||
          emp.id === entry.employee_id
        );

      if (!hasValidEmployee) return false;

      // Apply employee filter (multi-select)
      if (selectedEmployeeIds.length > 0 && entryEmployeeId && !selectedEmployeeIds.includes(entryEmployeeId)) {
        return false;
      }

      // Apply search filter
      if (searchTerm.trim()) {
        const displayName = employeeMap.get(entry.employee_name) ||
          employeeMap.get(entry.employee_id) ||
          entry.employee_name || '';
        if (!displayName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !entry.clock_in_date?.includes(searchTerm)) {
          return false;
        }
      }

      // Apply role filter
      if (selectedRole !== 'all') {
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

      return true;
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

      // Get employee-specific wage rates for export
      const employeeWages = employeeWageMap.get(entry.employee_name) ||
        employeeWageMap.get(entry.employee_id) ||
        employeeWageMap.get(displayName) ||
        { morning: wageSettings?.morning_wage_rate || 17, night: wageSettings?.night_wage_rate || 20 };

      return {
        ...entry,
        display_name: displayName,
        total_hours: morningHours + nightHours, // Use calculated total (morning + night) for consistency
        calculated_morning_hours: Math.max(0, morningHours),
        calculated_night_hours: Math.max(0, nightHours),
        total_card_amount_flat: Math.round(calculatedAmount),
        calculated_amount: Math.round(calculatedAmount),
        morning_wage_rate: employeeWages.morning,
        night_wage_rate: employeeWages.night
      };
    });
  }, [rawTimesheetData, employees, wageSettings, workingHoursSettings, selectedRole, selectedEmployeeIds, searchTerm]);

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

  // Quick date preset handlers
  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let newRange: DateRange;

    switch (preset) {
      case 'today':
        newRange = { from: today, to: today };
        break;
      case 'thisWeek':
        newRange = { from: startOfWeek(today), to: endOfWeek(today) };
        break;
      case 'lastWeek':
        const lastWeekStart = startOfWeek(subDays(today, 7));
        const lastWeekEnd = endOfWeek(subDays(today, 7));
        newRange = { from: lastWeekStart, to: lastWeekEnd };
        break;
      case 'thisMonth':
        newRange = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        newRange = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      case 'last7Days':
        newRange = { from: subDays(today, 6), to: today };
        break;
      case 'last30Days':
        newRange = { from: subDays(today, 29), to: today };
        break;
      default:
        return;
    }
    setDateRange(newRange);

    // Auto-set comparison period if enabled
    if (comparePeriod) {
      const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      setComparisonDateRange({
        from: subDays(newRange.from, daysDiff + 1),
        to: subDays(newRange.from, 1)
      });
    }
  };

  // Comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!comparePeriod || !comparisonDateRange) return null;

    // Calculate comparison period metrics (simplified - would need separate query in production)
    const currentTotalHours = keyMetrics.totalHours;
    const currentTotalAmount = keyMetrics.totalAmount;
    const currentTotalShifts = keyMetrics.totalShifts;

    // For now, return mock comparison (in production, fetch comparison period data)
    return {
      totalHours: currentTotalHours * 0.9, // Mock: 10% decrease
      totalAmount: currentTotalAmount * 0.9,
      totalShifts: Math.floor(currentTotalShifts * 0.95),
      hoursChange: ((currentTotalHours - (currentTotalHours * 0.9)) / (currentTotalHours * 0.9)) * 100,
      amountChange: ((currentTotalAmount - (currentTotalAmount * 0.9)) / (currentTotalAmount * 0.9)) * 100,
      shiftsChange: ((currentTotalShifts - Math.floor(currentTotalShifts * 0.95)) / Math.floor(currentTotalShifts * 0.95)) * 100
    };
  }, [comparePeriod, comparisonDateRange, keyMetrics]);

  // Handle attendance export with configuration
  const handleAttendanceExport = () => {
    const isPointsActive = pointsSystemData?.isPointsSystemActive || false;
    const pointValue = pointsSystemData?.pointValue || 5;
    const organizationName = pointsSystemData?.organizationName || '';
    const filename = `Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}`;

    // Append organization name to filename if available
    let finalFilename = filename;
    if (organizationName) {
      // Sanitize organization name for filename (remove special characters)
      const sanitizedOrgName = organizationName.replace(/[^a-zA-Z0-9]/g, '_');
      finalFilename = `Attendance_Report_${sanitizedOrgName}_${format(new Date(), 'yyyy-MM-dd')}`;
    }

    const maxHours = highlightLongShifts ? maxWorkingHours : 999; // Disable highlighting if unchecked

    exportAttendanceReportToExcel(
      attendanceReport,
      `${finalFilename}.xlsx`,
      dateRange,
      activeOrganizationId,
      isPointsActive,
      pointValue,
      maxHours,
      organizationName
    ).then(() => {
      toast.success(`${finalFilename}.xlsx ${t('exportedSuccessfully') || 'exported successfully'}`);
      setShowExportDialog(false);
    }).catch((error) => {
      console.error('Export error:', error);
      toast.error(t('failedToExport') || 'Failed to export report');
    });
  };

  // Enhanced export functionality
  const exportReport = (type: string) => {
    try {
      let data: any[] = [];
      let filename = '';
      let sheetName = '';

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
        filename = `Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}`;
        sheetName = t('attendanceReportLabel') || 'Attendance Report';
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
        filename = `Payroll_Summary_${format(new Date(), 'yyyy-MM-dd')}`;
        sheetName = t('payrollSummaryLabel') || 'Payroll Summary';
      }

      if (data.length === 0) {
        toast.error(t('noDataToExport') || 'No data to export');
        return;
      }

      const columns = Object.keys(data[0]);

      switch (exportFormat) {
        case 'excel':
          if (type === 'attendance') {
            // Show dialog for attendance export configuration
            setShowExportDialog(true);
          } else {
            exportToExcel(data, `${filename}.xlsx`, sheetName);
            toast.success(`${filename}.xlsx ${t('exportedSuccessfully') || 'exported successfully'}`);
          }
          break;
        case 'csv':
          exportToCSV(data, `${filename}.csv`);
          toast.success(`${filename}.csv ${t('exportedSuccessfully') || 'exported successfully'}`);
          break;
        case 'pdf':
          exportToPDF(data, columns, `${filename}.pdf`, sheetName);
          toast.success(`${t('pdfGenerated') || 'PDF generated'}`);
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('failedToExport') || 'Failed to export report');
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
          onPayPeriodEndDayChange={() => { }} // Read-only, configured in Settings
          payPeriodMode={mode}
        />


        {/* Advanced Filters */}
        <div className="mt-4 bg-gradient-to-br from-card to-card/50 rounded-xl border-2 border-border/50 shadow-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">{t('filters') || 'Filters'}</Label>
            {(selectedEmployeeIds.length > 0 || searchTerm.trim() || selectedRole !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedEmployeeIds([]);
                  setSearchTerm('');
                  setSelectedRole('all');
                }}
                className="text-xs"
              >
                <X className="h-3 w-3 me-1" />
                {t('clearFilters') || 'Clear All'}
              </Button>
            )}
          </div>

          {/* Employee Multi-Select */}
          <div className="space-y-2">
            <Label>{t('filterByEmployee') || 'Filter by Employee'}</Label>
            {employees && (
              <EmployeeMultiSelect
                employees={employees}
                selectedEmployeeIds={selectedEmployeeIds}
                onSelectionChange={setSelectedEmployeeIds}
                placeholder={t('selectEmployees') || 'Select employees'}
              />
            )}
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>{t('search') || 'Search'}</Label>
            <div className="relative">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchByNameOrDate') || 'Search by employee name or date...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-8"
              />
            </div>
          </div>

          {/* Role Filter */}
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

          {/* Comparison Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <div>
              <Label className="font-medium">{t('comparePeriod') || 'Compare with Previous Period'}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('comparePeriodDescription') || 'Compare current metrics with previous period'}
              </p>
            </div>
            <Button
              variant={comparePeriod ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setComparePeriod(!comparePeriod);
                if (!comparePeriod && dateRange) {
                  const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
                  setComparisonDateRange({
                    from: subDays(dateRange.from, daysDiff + 1),
                    to: subDays(dateRange.from, 1)
                  });
                } else {
                  setComparisonDateRange(null);
                }
              }}
            >
              {comparePeriod ? t('enabled') || 'Enabled' : t('enable') || 'Enable'}
            </Button>
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
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('totalHours')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-foreground">{keyMetrics.totalHours.toFixed(1)}h</p>
                        {comparisonMetrics && (
                          <div className={`flex items-center gap-1 text-xs ${comparisonMetrics.hoursChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {comparisonMetrics.hoursChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(comparisonMetrics.hoursChange).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {comparisonMetrics && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('previous')}: {comparisonMetrics.totalHours.toFixed(1)}h
                        </p>
                      )}
                    </div>
                    <Clock className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('totalShifts')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-foreground">{keyMetrics.totalShifts}</p>
                        {comparisonMetrics && (
                          <div className={`flex items-center gap-1 text-xs ${comparisonMetrics.shiftsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {comparisonMetrics.shiftsChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(comparisonMetrics.shiftsChange).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {comparisonMetrics && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('previous')}: {comparisonMetrics.totalShifts}
                        </p>
                      )}
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
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">{t('totalAmount')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{keyMetrics.totalAmount.toFixed(0)} LE</p>
                        {comparisonMetrics && (
                          <div className={`flex items-center gap-1 text-xs ${comparisonMetrics.amountChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {comparisonMetrics.amountChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(comparisonMetrics.amountChange).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {comparisonMetrics && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('previous')}: {comparisonMetrics.totalAmount.toFixed(0)} LE
                        </p>
                      )}
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
                      <div className="text-start">
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
                      <div className="text-start">
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
                      <div className="text-start">
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
                    {t('viewAll')} <ChevronRight className="h-4 w-4 ms-1" />
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
                        <div className="text-end">
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
          <Card className="border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentView('overview')}
                    className="hover:bg-primary/10"
                  >
                    {t('back')}
                  </Button>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    {t('attendanceReport')}
                  </CardTitle>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={attendanceReport.length === 0}
                    >
                      <Download className="h-4 w-4 me-2" />
                      {t('export') || 'Export'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">{t('exportFormat') || 'Export Format'}</Label>
                      <Select value={exportFormat} onValueChange={(val: 'excel' | 'csv' | 'pdf') => setExportFormat(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                          <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => exportReport('attendance')}
                        className="w-full"
                        size="sm"
                        disabled={attendanceReport.length === 0}
                      >
                        <Download className="h-4 w-4 me-2" />
                        {t('exportAttendance') || 'Export Attendance'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
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
          <Card className="border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentView('overview')}
                    className="hover:bg-green-500/10"
                  >
                    {t('back')}
                  </Button>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    </div>
                    {t('payrollSummary')}
                  </CardTitle>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={payrollSummary.length === 0}
                    >
                      <Download className="h-4 w-4 me-2" />
                      {t('export') || 'Export'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">{t('exportFormat') || 'Export Format'}</Label>
                      <Select value={exportFormat} onValueChange={(val: 'excel' | 'csv' | 'pdf') => setExportFormat(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                          <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => exportReport('payroll')}
                        className="w-full"
                        size="sm"
                        disabled={payrollSummary.length === 0}
                      >
                        <Download className="h-4 w-4 me-2" />
                        {t('exportPayroll') || 'Export Payroll'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
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

      {/* Export Configuration Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exportAttendance') || 'Export Attendance Report'}</DialogTitle>
            <DialogDescription>
              Configure export settings for the attendance report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="highlightLongShifts"
                  checked={highlightLongShifts}
                  onChange={(e) => setHighlightLongShifts(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="highlightLongShifts" className="cursor-pointer">
                  Highlight shifts exceeding working hours threshold
                </Label>
              </div>
              {highlightLongShifts && (
                <div className="ms-6 space-y-2">
                  <Label htmlFor="maxWorkingHours">Maximum Working Hours (hours)</Label>
                  <Input
                    id="maxWorkingHours"
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={maxWorkingHours}
                    onChange={(e) => setMaxWorkingHours(parseFloat(e.target.value) || 6)}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Shifts exceeding {maxWorkingHours} hours will be highlighted in yellow
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleAttendanceExport}>
              {t('export') || 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobilePageWrapper>
  );
};

export default ReportsPage;
