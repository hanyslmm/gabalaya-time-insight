import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { 
  Users, Clock, DollarSign, TrendingUp, ShieldAlert, 
  Activity, Calendar as CalendarIcon, 
  ArrowUpRight, ArrowDownRight, RefreshCw, GitCompare, Building2,
  Award, UserCheck
} from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';
import { useDashboardData } from '@/hooks/useDashboardData';
import PullToRefresh from '@/components/PullToRefresh';
import ProfileAvatar from '@/components/ProfileAvatar';
import GlobalSearch from '@/components/GlobalSearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date;
  to: Date;
}

const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get current organization name
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  const { data: currentOrg } = useQuery({
    queryKey: ['current-org-name', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', activeOrganizationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrganizationId
  });

  // Fetch available roles
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
  
  // State management
  const [datePreset, setDatePreset] = useState<string>('current');
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Calculate date ranges based on presets
  const getDateRangeForPreset = (preset: string): DateRange => {
    const today = new Date();
    
    switch (preset) {
      case 'today':
        return { from: startOfDay(today), to: endOfDay(today) };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case 'thisWeek':
        return { from: startOfWeek(today), to: endOfWeek(today) };
      case 'lastWeek':
        const lastWeekStart = startOfWeek(subDays(today, 7));
        const lastWeekEnd = endOfWeek(subDays(today, 7));
        return { from: lastWeekStart, to: lastWeekEnd };
      case 'thisMonth':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'last7Days':
        return { from: subDays(today, 6), to: today };
      case 'last30Days':
        return { from: subDays(today, 29), to: today };
      case 'thisYear':
        return { from: startOfYear(today), to: endOfYear(today) };
      case 'current':
        // Current period: 1st of month to today
        const year = today.getFullYear();
        const month = today.getMonth();
        return { from: new Date(year, month, 1), to: today };
      case 'previous':
        // Previous month: full month
        const prevMonth = subMonths(today, 1);
        return { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) };
      default:
        return { from: startOfMonth(today), to: today };
    }
  };

  // Determine active date range
  const activePeriod = useMemo(() => {
    if (customDateRange) {
      return customDateRange;
    }
    return getDateRangeForPreset(datePreset);
  }, [datePreset, customDateRange]);

  // Calculate previous period for comparison - intelligently based on selected preset
  const previousPeriod = useMemo(() => {
    const today = new Date();
    
    // If custom date range, calculate previous period by subtracting the same duration
    if (customDateRange) {
    const daysDiff = Math.ceil((activePeriod.to.getTime() - activePeriod.from.getTime()) / (1000 * 60 * 60 * 24));
    const prevTo = new Date(activePeriod.from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - daysDiff);
    return { from: prevFrom, to: prevTo };
    }
    
    // Calculate previous equivalent period based on preset
    switch (datePreset) {
      case 'today':
        // Today → Yesterday
        const yesterday = subDays(today, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      
      case 'yesterday':
        // Yesterday → Day before yesterday
        const dayBeforeYesterday = subDays(today, 2);
        return { from: startOfDay(dayBeforeYesterday), to: endOfDay(dayBeforeYesterday) };
      
      case 'thisWeek':
        // This week → Last week
        const lastWeekStart = startOfWeek(subDays(today, 7));
        const lastWeekEnd = endOfWeek(subDays(today, 7));
        return { from: lastWeekStart, to: lastWeekEnd };
      
      case 'lastWeek':
        // Last week → Week before last week
        const weekBeforeLastStart = startOfWeek(subDays(today, 14));
        const weekBeforeLastEnd = endOfWeek(subDays(today, 14));
        return { from: weekBeforeLastStart, to: weekBeforeLastEnd };
      
      case 'thisMonth':
        // This month → Last month
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      
      case 'lastMonth':
        // Last month → Month before last month
        const monthBeforeLast = subMonths(today, 2);
        return { from: startOfMonth(monthBeforeLast), to: endOfMonth(monthBeforeLast) };
      
      case 'last7Days':
        // Last 7 days → Previous 7 days (7-14 days ago)
        // Current: today-6 to today (7 days), Previous: today-13 to today-7 (7 days)
        const prev7DaysEnd = subDays(today, 7);
        const prev7DaysStart = subDays(prev7DaysEnd, 6);
        return { from: prev7DaysStart, to: prev7DaysEnd };
      
      case 'last30Days':
        // Last 30 days → Previous 30 days (30-60 days ago)
        // Current: today-29 to today (30 days), Previous: today-59 to today-30 (30 days)
        const prev30DaysEnd = subDays(today, 30);
        const prev30DaysStart = subDays(prev30DaysEnd, 29);
        return { from: prev30DaysStart, to: prev30DaysEnd };
      
      case 'thisYear':
        // This year → Last year
        const lastYear = today.getFullYear() - 1;
        return { from: startOfYear(new Date(lastYear, 0, 1)), to: endOfYear(new Date(lastYear, 11, 31)) };
      
      case 'current':
        // Current period (month to date) → Previous month (full month)
        const prevMonth = subMonths(today, 1);
        return { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) };
      
      case 'previous':
        // Previous month → Month before previous month
        const monthBeforePrevious = subMonths(today, 2);
        return { from: startOfMonth(monthBeforePrevious), to: endOfMonth(monthBeforePrevious) };
      
      default:
        // Default: subtract same duration
        const daysDiff = Math.ceil((activePeriod.to.getTime() - activePeriod.from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(activePeriod.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - daysDiff);
        return { from: prevFrom, to: prevTo };
    }
  }, [activePeriod, datePreset, customDateRange]);

  // Fetch data with auto-refresh
  const { 
    data: activeData, 
    isLoading: activeLoading,
    refetch: refetchActive,
    dataUpdatedAt: activeUpdatedAt
  } = useDashboardData(activePeriod, true, selectedRole);

  const { 
    data: previousData,
    refetch: refetchPrevious
  } = useDashboardData(previousPeriod, compareMode, selectedRole);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!compareMode) {
      const interval = setInterval(() => {
        refetchActive();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [refetchActive, compareMode]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchActive(),
      compareMode ? refetchPrevious() : Promise.resolve()
    ]);
    setIsRefreshing(false);
  };

  // Format time ago
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('justNow') || 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${t('minutesAgo') || 'minutes ago'}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${t('hoursAgo') || 'hours ago'}`;
  };

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    setCustomDateRange(null);
  };

  // Handle custom date range selection
  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setCustomDateRange({ from: range.from, to: range.to });
      setDatePreset('custom');
    }
  };

  // Calculate percentage changes
  const getPercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Get period label
  const getPeriodLabel = () => {
    if (datePreset === 'custom' && customDateRange) {
      return `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd, yyyy')}`;
    }
    const presetLabels: Record<string, string> = {
      today: t('today') || 'Today',
      yesterday: t('yesterday') || 'Yesterday',
      thisWeek: t('thisWeek') || 'This Week',
      lastWeek: t('lastWeek') || 'Last Week',
      thisMonth: t('thisMonth') || 'This Month',
      lastMonth: t('lastMonth') || 'Last Month',
      last7Days: t('last7Days') || 'Last 7 Days',
      last30Days: t('last30Days') || 'Last 30 Days',
      thisYear: t('thisYear') || 'This Year',
      current: t('currentPeriod') || 'Current Period',
      previous: t('previousPeriod') || 'Previous Period',
    };
    return presetLabels[datePreset] || t('custom') || 'Custom';
  };

  // Get previous period label for comparison
  const getPreviousPeriodLabel = () => {
    if (datePreset === 'custom' && previousPeriod) {
      return `${format(previousPeriod.from, 'MMM dd')} - ${format(previousPeriod.to, 'MMM dd, yyyy')}`;
    }
    const previousPresetLabels: Record<string, string> = {
      today: t('yesterday') || 'Yesterday',
      yesterday: t('dayBeforeYesterday') || 'Day Before Yesterday',
      thisWeek: t('lastWeek') || 'Last Week',
      lastWeek: t('weekBeforeLast') || 'Week Before Last',
      thisMonth: t('lastMonth') || 'Last Month',
      lastMonth: t('monthBeforeLast') || 'Month Before Last',
      last7Days: t('previous7Days') || 'Previous 7 Days',
      last30Days: t('previous30Days') || 'Previous 30 Days',
      thisYear: t('lastYear') || 'Last Year',
      current: t('lastMonth') || 'Last Month',
      previous: t('monthBeforeLast') || 'Month Before Last',
    };
    return previousPresetLabels[datePreset] || `${format(previousPeriod.from, 'MMM dd')} - ${format(previousPeriod.to, 'MMM dd, yyyy')}`;
  };

  // Check if user is admin or owner - restrict dashboard access to admins and owners only
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            {t('accessDenied')}
            <div className="mt-4">
              <Button 
                onClick={() => navigate('/clock-in-out')}
                variant="outline"
                size="sm"
              >
                {t('goToClockInOut')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  const stats = [
    {
      title: t('totalEmployees'),
      value: activeLoading ? '...' : Math.round(activeData?.employeeCount || 0),
      description: t('employeesWithClockIns') || 'Employees with clock-ins in period',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      textColor: 'text-blue-700 dark:text-blue-400',
      change: compareMode ? getPercentageChange(activeData?.employeeCount || 0, previousData?.employeeCount || 0) : 0,
    },
    {
      title: `${getPeriodLabel()} ${t('hours')}`,
      value: activeLoading ? '...' : (activeData?.totalHours?.toFixed(1) || '0.0'),
      description: `${t('hoursWorked')} • Avg: ${activeData?.averageHoursPerEmployee?.toFixed(1) || '0.0'}h/emp`,
      icon: Clock,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      textColor: 'text-green-700 dark:text-green-400',
      change: compareMode ? getPercentageChange(activeData?.totalHours || 0, previousData?.totalHours || 0) : 0,
    },
    {
      title: `${getPeriodLabel()} ${t('payroll')}`,
      value: activeLoading ? '...' : `${(activeData?.totalPayroll?.toFixed(0) || '0')} LE`,
      description: t('totalEarnings'),
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      textColor: 'text-purple-700 dark:text-purple-400',
      change: compareMode ? getPercentageChange(activeData?.totalPayroll || 0, previousData?.totalPayroll || 0) : 0,
    },
    {
      title: t('attendanceRate'),
      value: activeLoading ? '...' : `${(activeData?.attendanceRate || 0).toFixed(1)}%`,
      description: t('employeesWithShifts'),
      icon: UserCheck,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      change: compareMode ? getPercentageChange(activeData?.attendanceRate || 0, previousData?.attendanceRate || 0) : 0,
    },
    {
      title: `${getPeriodLabel()} ${t('shifts')}`,
      value: activeLoading ? '...' : Math.round(activeData?.totalShifts || 0),
      description: t('completedShifts'),
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      textColor: 'text-orange-700 dark:text-orange-400',
      change: compareMode ? getPercentageChange(activeData?.totalShifts || 0, previousData?.totalShifts || 0) : 0,
    }
  ];

  return (
    <PullToRefresh onRefresh={handleManualRefresh}>
      <div className="w-full px-3 sm:px-6 lg:px-8 pb-8">
        {/* Hero Header Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 sm:p-8 mb-8">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    {t('dashboard') || 'Dashboard'}
                  </h1>
                  <Badge variant="secondary" className="animate-pulse">
                    {t('live')}
                  </Badge>
                  {currentOrg && (
                    <Badge variant="outline" className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {currentOrg.name}
                    </Badge>
                  )}
                </div>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                  {currentOrg 
                    ? `${t('realTimeInsights')} • ${currentOrg.name}`
                    : t('realTimeInsights')
                  }
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    <span>{activeData?.employeeCount || 0} {t('activeEmployees')}</span>
                  </div>
                  {activeUpdatedAt && (
                    <div className="flex items-center gap-1">
                      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                      <span className="text-xs">
                        {t('lastUpdated') || 'Last updated'}: {getTimeAgo(activeUpdatedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role Filter */}
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-44 bg-background/80 backdrop-blur-sm border-border/50">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder={t('filterByRole') || 'Filter by Role'} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allRoles') || 'All Roles'}</SelectItem>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Enhanced Date Range Selection */}
                  <Select value={datePreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-44 bg-background/80 backdrop-blur-sm border-border/50">
                      <SelectValue placeholder={t('selectPeriod')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">{t('today') || 'Today'}</SelectItem>
                      <SelectItem value="yesterday">{t('yesterday') || 'Yesterday'}</SelectItem>
                      <SelectItem value="thisWeek">{t('thisWeek') || 'This Week'}</SelectItem>
                      <SelectItem value="lastWeek">{t('lastWeek') || 'Last Week'}</SelectItem>
                      <SelectItem value="thisMonth">{t('thisMonth') || 'This Month'}</SelectItem>
                      <SelectItem value="lastMonth">{t('lastMonth') || 'Last Month'}</SelectItem>
                      <SelectItem value="last7Days">{t('last7Days') || 'Last 7 Days'}</SelectItem>
                      <SelectItem value="last30Days">{t('last30Days') || 'Last 30 Days'}</SelectItem>
                      <SelectItem value="current">{t('currentPeriod') || 'Current Period'}</SelectItem>
                      <SelectItem value="previous">{t('previousPeriod') || 'Previous Period'}</SelectItem>
                      <SelectItem value="custom">{t('customRange') || 'Custom Range'}</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Custom Date Range Picker */}
                  {datePreset === 'custom' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[240px] justify-start text-left font-normal bg-background/80 backdrop-blur-sm border-border/50",
                            !customDateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange ? (
                            <>
                              {format(customDateRange.from, 'MMM dd, yyyy')} - {format(customDateRange.to, 'MMM dd, yyyy')}
                            </>
                          ) : (
                            <span>{t('selectDateRange') || 'Select date range'}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: customDateRange?.from, to: customDateRange?.to }}
                          onSelect={handleCustomDateSelect}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Comparison Mode Toggle */}
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompareMode(!compareMode)}
                    className="bg-background/80 backdrop-blur-sm border-border/50"
                  >
                    <GitCompare className="h-4 w-4 mr-2" />
                    {t('compare') || 'Compare'}
                  </Button>

                  {/* Manual Refresh Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="bg-background/80 backdrop-blur-sm border-border/50"
                  >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <GlobalSearch />
                  <ProfileAvatar />
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full translate-y-24 -translate-x-24" />
        </div>

        {/* Comparison Mode Stats */}
        {compareMode && previousData && (
          <div className="mb-8">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  {t('periodComparison') || 'Period Comparison'}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {getPeriodLabel()} vs {getPreviousPeriodLabel()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {stats.map((stat, index) => {
                    const currentValue = stat.value;
                    let previousValue: string | number = '';
                    if (index === 0) {
                      previousValue = Math.round(previousData?.employeeCount || 0);
                    } else if (index === 1) {
                      previousValue = (previousData?.totalHours?.toFixed(1) || '0.0');
                    } else if (index === 2) {
                      previousValue = `${(previousData?.totalPayroll?.toFixed(0) || '0')} LE`;
                    } else if (index === 3) {
                      previousValue = `${(previousData?.attendanceRate || 0).toFixed(1)}%`;
                    } else {
                      previousValue = Math.round(previousData?.totalShifts || 0);
                    }
                    
                    return (
                      <div key={index} className="p-4 rounded-lg border border-border/50 bg-background/50">
                        <div className="text-sm text-muted-foreground mb-2">{stat.title}</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold">{currentValue}</div>
                            <div className="text-xs text-muted-foreground">{getPeriodLabel()}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-muted-foreground">{previousValue}</div>
                            <div className="text-xs text-muted-foreground">{getPreviousPeriodLabel()}</div>
                          </div>
                        </div>
                        {stat.change !== 0 && (
                          <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                            stat.change > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {stat.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(stat.change).toFixed(1)}% {t('change') || 'change'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card 
              key={index}
              className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 cursor-pointer bg-gradient-to-br from-card to-card/90 backdrop-blur-sm"
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">
                      {stat.value}
                    </span>
                    {stat.change !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        stat.change > 0 
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                      }`}>
                        {stat.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(stat.change).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl ${stat.bgColor} ${stat.textColor} transition-colors duration-300`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 relative z-10">
                <p className="text-sm text-muted-foreground">{stat.description}</p>
                {stat.change !== 0 && compareMode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    vs {getPreviousPeriodLabel()}
                  </p>
                )}
              </CardContent>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                   style={{ background: `linear-gradient(90deg, transparent, ${stat.color.split(' ')[1]}/0.2, transparent)` }} />
            </Card>
          ))}
        </div>

        {/* Strategic Analytics */}
        <DashboardCharts
          timePeriod="month"
          dateRange={activePeriod}
          roleFilter={selectedRole}
        />

        {/* Top Performers & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Performers */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    {t('topPerformers') || 'Top Performers'}
                </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('topEmployeesByHours') || 'Top 5 employees by hours worked'}
                  </p>
              </div>
              <Badge variant="outline" className="text-xs">
                  {getPeriodLabel()}
              </Badge>
            </div>
          </CardHeader>
            <CardContent>
              {activeLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                    </div>
                  ))}
                </div>
              ) : activeData?.topPerformers && activeData.topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {activeData.topPerformers.map((performer, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-all bg-background/50"
                    >
                      <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{performer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {performer.hours.toFixed(1)}h • {performer.shifts} {t('shifts') || 'shifts'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          {performer.hours.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('noDataAvailable') || 'No data available for this period'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    {t('recentActivity') || 'Recent Activity'}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('latestClockIns') || 'Latest clock-ins and shifts'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {activeData?.recentActivity?.length || 0}
                    </Badge>
                  </div>
            </CardHeader>
            <CardContent>
              {activeLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeData?.recentActivity && activeData.recentActivity.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {activeData.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-all bg-background/50"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{activity.employee_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(activity.clock_in_date), 'MMM dd, yyyy')}
                          {activity.clock_in_time && (
                            <>
                              <span>•</span>
                              <span>{activity.clock_in_time.split('.')[0]}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">
                          {activity.total_hours.toFixed(1)}h
                        </div>
                      </div>
                    </div>
              ))}
            </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('noRecentActivity') || 'No recent activity'}</p>
                </div>
              )}
          </CardContent>
        </Card>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default DashboardPage;
