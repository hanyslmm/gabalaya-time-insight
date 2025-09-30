import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays, parseISO } from 'date-fns';
import { Clock, Users, TrendingUp, Calendar } from 'lucide-react';
import { getCompanyTimezone } from '@/utils/timezoneUtils';
import { useAuth } from '@/hooks/useAuth';

interface DateRange {
  from: Date;
  to: Date;
}

interface HRAnalyticsProps {
  dateRange: DateRange;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export const HRAnalytics: React.FC<HRAnalyticsProps> = ({ dateRange }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === 'ar';
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  
  const [morningVsNightData, setMorningVsNightData] = useState<any[]>([]);
  const [weekdayPeakData, setWeekdayPeakData] = useState<any[]>([]);
  const [hourlyPeakData, setHourlyPeakData] = useState<any[]>([]);
  const [activeEmployeesData, setActiveEmployeesData] = useState<any[]>([]);
  const [dailyEmployeeData, setDailyEmployeeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('HRAnalytics: activeOrganizationId:', activeOrganizationId);

  // Get employees for current organization to filter analytics data
  const { data: employees } = useQuery({
    queryKey: ['employees-analytics', activeOrganizationId],
    queryFn: async (): Promise<any[]> => {
      console.log('HRAnalytics: Fetching employees for org:', activeOrganizationId);
      let q = supabase.from('employees').select('id, staff_id, full_name');
      if (activeOrganizationId) {
        q = q.eq('organization_id', activeOrganizationId);
      }
      const { data, error } = await q;
      if (error) throw error;
      console.log('HRAnalytics: Fetched employees:', data?.length);
      return data || [];
    }
  });

  useEffect(() => {
    if (employees !== undefined) {
    fetchAnalyticsData();
    }
  }, [dateRange, activeOrganizationId, employees]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      console.log('HRAnalytics: Fetching analytics data...');
      
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      
      const applyDateFilter = (q: any) => {
        return q
          .gte('clock_in_date', fromDate)
          .lte('clock_out_date', toDate);
      };

      let timesheetData: any[] = [];

      if (!activeOrganizationId) {
        // No organization - get all data
        let query = supabase.from('timesheet_entries').select('*');
        query = applyDateFilter(query);
        const { data, error } = await query;
        if (error) throw error;
        timesheetData = data || [];
      } else {
        // Build employee matching for legacy rows
        const employeeIds = employees?.map(e => e.id) || [];
        const employeeStaffIds = employees?.map(e => e.staff_id).filter(Boolean) || [];
        const employeeNames = employees?.map(e => e.full_name).filter(Boolean) || [];

        console.log('HRAnalytics: Filtering by employees:', employeeNames);

        // Query A: organization-specific entries
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

        // Combine results
        timesheetData = [...(resOrg.data || []), ...(resLegacy.data || [])];
        console.log('HRAnalytics: Combined timesheet data:', timesheetData.length, 'entries');
      }

      const tz = await getCompanyTimezone();

      // Create employee validation set
      const validEmployeeNames = new Set(employees?.map(e => e.full_name) || []);
      const validEmployeeStaffIds = new Set(employees?.map(e => e.staff_id).filter(Boolean) || []);
      const validEmployeeIds = new Set(employees?.map(e => e.id) || []);

      console.log('HRAnalytics: Valid employees for analytics:', Array.from(validEmployeeNames));

      // Filter timesheet data to only include employees from current organization
      const filteredTimesheetData = timesheetData?.filter(entry => {
        const isValidEmployee = validEmployeeNames.has(entry.employee_name) ||
                                validEmployeeStaffIds.has(entry.employee_name) ||
                                validEmployeeIds.has(entry.employee_id);
        return isValidEmployee;
      }) || [];

      console.log('HRAnalytics: Filtered timesheet data:', filteredTimesheetData.length, 'entries (from', timesheetData.length, 'total)');

      // Process morning vs night hours
      const morningNightData = [];
      const groupedByEmployee = new Map();

      filteredTimesheetData.forEach(entry => {
        const employeeName = entry.employee_name;
        if (!groupedByEmployee.has(employeeName)) {
          groupedByEmployee.set(employeeName, {
            name: employeeName,
            morning: 0,
            night: 0
          });
        }
        
        const emp = groupedByEmployee.get(employeeName);
        
        // Use stored hours if available
        let morningHours = entry.morning_hours || 0;
        let nightHours = entry.night_hours || 0;
        
        // If no morning/night breakdown but has total hours, assume all are morning hours
        if (morningHours === 0 && nightHours === 0 && entry.total_hours > 0) {
          morningHours = entry.total_hours;
        }
        
        emp.morning += morningHours;
        emp.night += nightHours;
      });

      console.log('HRAnalytics: Morning vs Night data:', Array.from(groupedByEmployee.values()));

      // Filter out employees with zero hours
      const morningNightDataFiltered = Array.from(groupedByEmployee.values()).filter(emp => 
        emp.morning > 0 || emp.night > 0
      );

      console.log('HRAnalytics: After filtering zero hours:', morningNightDataFiltered.length, 'employees');

      setMorningVsNightData(morningNightDataFiltered);

      // Process weekday peak data
      const weekdayMap = new Map();
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      console.log('HRAnalytics: Processing weekday peak data with', filteredTimesheetData.length, 'entries');
      
      filteredTimesheetData.forEach(entry => {
        const date = parseISO(entry.clock_in_date);
        const dayOfWeek = weekdays[date.getDay()];
        
        if (!weekdayMap.has(dayOfWeek)) {
          weekdayMap.set(dayOfWeek, 0);
        }
        weekdayMap.set(dayOfWeek, weekdayMap.get(dayOfWeek) + 1);
      });

      console.log('HRAnalytics: Weekday distribution:', Array.from(weekdayMap.entries()).map(([day, count]) => `${day}: ${count}`));

      const weekdayData = weekdays.map(day => ({
        day: isRTL ? {
          'Sunday': 'الأحد',
          'Monday': 'الإثنين', 
          'Tuesday': 'الثلاثاء',
          'Wednesday': 'الأربعاء',
          'Thursday': 'الخميس',
          'Friday': 'الجمعة',
          'Saturday': 'السبت'
        }[day] : day,
        employees: weekdayMap.get(day) || 0
      }));

      setWeekdayPeakData(weekdayData);

      // Process hourly peak data - Split Clock-In vs Clock-Out
      const hourlyClockInMap = new Map();
      const hourlyClockOutMap = new Map();
      for (let i = 0; i < 24; i++) {
        hourlyClockInMap.set(i, 0);
        hourlyClockOutMap.set(i, 0);
      }

      console.log('HRAnalytics: Processing hourly clock-in/out data with', filteredTimesheetData.length, 'entries');
      let clockInCount = 0;
      let clockOutCount = 0;

      filteredTimesheetData.forEach((entry, index) => {
        // Process clock-in times
        if (entry.clock_in_time) {
          const timeClean = (entry.clock_in_time || '').split('.')[0] || '00:00:00';
          const dt = new Date(`${entry.clock_in_date}T${timeClean}Z`);
          const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(dt);
          const hour = parseInt(hourStr, 10);
          hourlyClockInMap.set(hour, (hourlyClockInMap.get(hour) || 0) + 1);
          clockInCount++;
        }
        
        // Process clock-out times
        if (entry.clock_out_time && entry.clock_out_time !== '00:00:00') {
          const timeClean = (entry.clock_out_time || '').split('.')[0] || '00:00:00';
          const outDate = entry.clock_out_date || entry.clock_in_date;
          const dt = new Date(`${outDate}T${timeClean}Z`);
          const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(dt);
          const hour = parseInt(hourStr, 10);
          hourlyClockOutMap.set(hour, (hourlyClockOutMap.get(hour) || 0) + 1);
          clockOutCount++;
        }
      });

      console.log('HRAnalytics: Processed', clockInCount, 'clock-ins and', clockOutCount, 'clock-outs');

      // Combine clock-in and clock-out data
      const hourlyData = Array.from(hourlyClockInMap.entries()).map(([hour, clockInCount]) => ({
        hour: `${hour}:00`,
        clockIn: clockInCount,
        clockOut: hourlyClockOutMap.get(hour) || 0
      }));

      setHourlyPeakData(hourlyData);

      // Process active employees per hour
      const activeByHour = new Map();
      for (let hour = 0; hour < 24; hour++) {
        activeByHour.set(hour, new Set());
      }

      console.log('HRAnalytics: Calculating active employees per hour...');

      filteredTimesheetData.forEach(entry => {
        if (entry.clock_in_time && entry.clock_out_time) {
          // Parse clock-in and clock-out times
          const inTimeClean = (entry.clock_in_time || '').split('.')[0];
          const outTimeClean = (entry.clock_out_time || '').split('.')[0];
          
          const inDate = new Date(`${entry.clock_in_date}T${inTimeClean}Z`);
          const outDate = new Date(`${entry.clock_out_date || entry.clock_in_date}T${outTimeClean}Z`);
          
          const inHourStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(inDate);
          const outHourStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(outDate);
          
          const inHour = parseInt(inHourStr, 10);
          let outHour = parseInt(outHourStr, 10);
          
          // Handle overnight shifts
          if (outHour < inHour) {
            outHour += 24;
          }
          
          // Mark employee as active for all hours between clock-in and clock-out
          for (let hour = inHour; hour <= outHour && hour < 24; hour++) {
            activeByHour.get(hour)?.add(entry.employee_name);
          }
        }
      });

      const activeEmployeesHourly = Array.from(activeByHour.entries()).map(([hour, employeeSet]) => ({
        hour: `${hour}:00`,
        active: employeeSet.size
      }));

      console.log('HRAnalytics: Active employees per hour calculated');
      const peakActiveHour = activeEmployeesHourly.reduce((max, curr) => curr.active > max.active ? curr : max, { hour: '0:00', active: 0 });
      console.log('HRAnalytics: Peak active hour:', peakActiveHour.hour, 'with', peakActiveHour.active, 'employees');

      setActiveEmployeesData(activeEmployeesHourly);

      // Process daily employee count
      const dailyEmployeeCountData = [];
      const dailyEmployeeMap = new Map();
      const dateRangeInterval = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to
      });

      console.log('HRAnalytics: Processing daily employee count for', dateRangeInterval.length, 'days');

      dateRangeInterval.forEach(date => {
        dailyEmployeeMap.set(format(date, 'yyyy-MM-dd'), new Set());
      });

      filteredTimesheetData.forEach(entry => {
        const date = entry.clock_in_date;
        if (dailyEmployeeMap.has(date)) {
          dailyEmployeeMap.get(date).add(entry.employee_name);
        }
      });

      const dailyData = Array.from(dailyEmployeeMap.entries()).map(([date, employees]) => ({
        date: format(parseISO(date), 'MMM dd'),
        employees: employees.size
      }));

      // Log sample of daily data
      const sortedDaily = dailyData.filter(d => d.employees > 0).sort((a, b) => b.employees - a.employees);
      console.log('HRAnalytics: Top 3 busiest days:', sortedDaily.slice(0, 3).map(d => `${d.date}: ${d.employees} employees`));

      setDailyEmployeeData(dailyData);

    } catch (error) {
      // Silently handle analytics fetch errors
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-64 bg-muted/20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Morning vs Night Hours */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse font-arabic' : ''}`}>
              <Clock className="h-5 w-5 text-primary" />
              <span>{isRTL ? 'ساعات الصباح مقابل ساعات الليل' : 'Morning vs Night Hours'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={morningVsNightData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="morning" fill="#8884d8" name={isRTL ? 'الصباح' : 'Morning'} />
                <Bar dataKey="night" fill="#82ca9d" name={isRTL ? 'الليل' : 'Night'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekday Peak */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse font-arabic' : ''}`}>
              <Calendar className="h-5 w-5 text-primary" />
              <span>{isRTL ? 'ذروة أيام الأسبوع' : 'Weekday Peak Activity'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weekdayPeakData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="employees" fill="#ffc658" name={isRTL ? 'الموظفين' : 'Employees'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Peak */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse font-arabic' : ''}`}>
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>{isRTL ? 'ذروة الساعات في اليوم' : 'Peak Hours of Day'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyPeakData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="clockIn" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={isRTL ? 'تسجيل الدخول' : 'Clock In'}
                />
                <Line 
                  type="monotone" 
                  dataKey="clockOut" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={isRTL ? 'تسجيل الخروج' : 'Clock Out'}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Employees Per Hour - NEW CHART */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse font-arabic' : ''}`}>
              <Users className="h-5 w-5 text-primary" />
              <span>{isRTL ? 'الموظفون النشطون في الساعة' : 'Active Employees Per Hour'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activeEmployeesData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="active" 
                  fill="#8b5cf6" 
                  name={isRTL ? 'الموظفون النشطون' : 'Active Employees'}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Employee Count */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse font-arabic' : ''}`}>
              <Users className="h-5 w-5 text-primary" />
              <span>{isRTL ? 'عدد الموظفين يومياً' : 'Daily Employee Count'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyEmployeeData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="employees" 
                  stroke="#00ff00" 
                  strokeWidth={2}
                  name={isRTL ? 'الموظفين' : 'Employees'}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};