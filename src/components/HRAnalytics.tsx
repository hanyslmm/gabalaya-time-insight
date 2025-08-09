import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const isRTL = i18n.language === 'ar';
  const [morningVsNightData, setMorningVsNightData] = useState<any[]>([]);
  const [weekdayPeakData, setWeekdayPeakData] = useState<any[]>([]);
  const [hourlyPeakData, setHourlyPeakData] = useState<any[]>([]);
  const [dailyEmployeeData, setDailyEmployeeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch timesheet data for the date range
      const { data: timesheetData, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_out_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (error) throw error;

      const tz = await getCompanyTimezone();

      // Process morning vs night hours
      const morningNightData = [];
      const groupedByEmployee = new Map();

      timesheetData?.forEach(entry => {
        const employeeName = entry.employee_name;
        if (!groupedByEmployee.has(employeeName)) {
          groupedByEmployee.set(employeeName, {
            name: employeeName,
            morning: 0,
            night: 0
          });
        }
        
        const emp = groupedByEmployee.get(employeeName);
        emp.morning += entry.morning_hours || 0;
        emp.night += entry.night_hours || 0;
      });

      setMorningVsNightData(Array.from(groupedByEmployee.values()));

      // Process weekday peak data
      const weekdayMap = new Map();
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      timesheetData?.forEach(entry => {
        const date = parseISO(entry.clock_in_date);
        const dayOfWeek = weekdays[date.getDay()];
        
        if (!weekdayMap.has(dayOfWeek)) {
          weekdayMap.set(dayOfWeek, 0);
        }
        weekdayMap.set(dayOfWeek, weekdayMap.get(dayOfWeek) + 1);
      });

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

      // Process hourly peak data
      const hourlyMap = new Map();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, 0);
      }

      timesheetData?.forEach(entry => {
        if (entry.clock_in_time) {
          const timeClean = (entry.clock_in_time || '').split('.')[0] || '00:00:00';
          const dt = new Date(`${entry.clock_in_date}T${timeClean}Z`);
          const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(dt);
          const hour = parseInt(hourStr, 10);
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        }
      });

      const hourlyData = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
        hour: `${hour}:00`,
        employees: count
      }));

      setHourlyPeakData(hourlyData);

      // Process daily employee count
      const dailyEmployeeCountData = [];
      const dailyEmployeeMap = new Map();
      const dateRangeInterval = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to
      });

      dateRangeInterval.forEach(date => {
        dailyEmployeeMap.set(format(date, 'yyyy-MM-dd'), new Set());
      });

      timesheetData?.forEach(entry => {
        const date = entry.clock_in_date;
        if (dailyEmployeeMap.has(date)) {
          dailyEmployeeMap.get(date).add(entry.employee_name);
        }
      });

      const dailyData = Array.from(dailyEmployeeMap.entries()).map(([date, employees]) => ({
        date: format(parseISO(date), 'MMM dd'),
        employees: employees.size
      }));

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
                <Line 
                  type="monotone" 
                  dataKey="employees" 
                  stroke="#ff7300" 
                  strokeWidth={2}
                  name={isRTL ? 'الموظفين' : 'Employees'}
                />
              </LineChart>
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