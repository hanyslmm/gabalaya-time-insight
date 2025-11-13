import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Clock, DollarSign, TrendingUp, Upload, Download, Settings, ShieldAlert, 
  Activity, BarChart3, Calendar, Timer, Zap, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';
import { useDashboardData } from '@/hooks/useDashboardData';
import PullToRefresh from '@/components/PullToRefresh';
import ProfileAvatar from '@/components/ProfileAvatar';
import GlobalSearch from '@/components/GlobalSearch';
import { ThemeToggle } from '@/components/ThemeToggle';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Redirect admin users to Clock In/Out page (Dashboard is owner-only)
  React.useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/clock-in-out', { replace: true });
    }
  }, [user, navigate]);
  
  // All hooks must be called before any conditional returns
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Pay period calculation
  const calculatePayPeriod = (baseDate: Date, offsetMonths: number = 0) => {
    const targetDate = new Date(baseDate);
    targetDate.setMonth(targetDate.getMonth() + offsetMonths);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    if (offsetMonths === 0) { // Current period: 1st of month to today
      const startDate = new Date(year, month, 1);
      const endDate = new Date(); // Today
      return { from: startDate, to: endDate };
    }
    
    // Previous or custom periods: Full month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of the month
    return { from: startDate, to: endDate };
  };

  // Handle month selection
  const getMonthPeriod = (monthOffset: number) => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    return { from: targetDate, to: endDate };
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'current') return 'Current';
    if (selectedPeriod === 'previous') return 'Previous';
    if (selectedMonth) {
      const monthNames = ['This Month', 'Last Month', '2 Months Ago'];
      const index = Math.abs(parseInt(selectedMonth));
      return monthNames[index] || 'Custom';
    }
    return 'Total';
  };

  // Memoize period calculations
  const currentPeriod = useMemo(() => calculatePayPeriod(new Date()), []);
  const previousPeriod = useMemo(() => calculatePayPeriod(new Date(), -1), []);

  // Determine active period for data fetching
  const activePeriod = useMemo(() => {
    if (selectedPeriod === 'current') return currentPeriod;
    if (selectedPeriod === 'previous') return previousPeriod;
    if (selectedPeriod === 'custom' && selectedMonth) {
      const monthOffset = parseInt(selectedMonth);
      return getMonthPeriod(monthOffset);
    }
    return currentPeriod; // Default to current period
  }, [selectedPeriod, selectedMonth, currentPeriod, previousPeriod]);

  // Fetch data for the active period
  const { data: activeData, isLoading: activeLoading } = useDashboardData(activePeriod);
  const { data: previousData } = useDashboardData(previousPeriod);

  // Calculate percentage changes
  const getPercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Check if user is admin or owner - restrict dashboard access to admins and owners only
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Access denied. The dashboard is only available for administrators.
            <div className="mt-4">
              <Button 
                onClick={() => navigate('/clock-in-out')}
                variant="outline"
                size="sm"
              >
                Go to Clock In/Out
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const quickActions = [
    { 
      title: 'View Timesheets', 
      description: 'Manage employee time records', 
      icon: Timer, 
      action: () => navigate('/timesheets'), 
      color: 'from-blue-500 to-blue-600',
      shortcut: 'T'
    },
    { 
      title: 'Employee Monitor', 
      description: 'Live attendance tracking', 
      icon: Activity, 
      action: () => navigate('/monitor'), 
      color: 'from-green-500 to-green-600',
      shortcut: 'M'
    },
    { 
      title: 'Manage Team', 
      description: 'Add & edit employees', 
      icon: Users, 
      action: () => navigate('/employees'), 
      color: 'from-purple-500 to-purple-600',
      shortcut: 'E'
    },
    { 
      title: 'Reports & Analytics', 
      description: 'Export payroll data', 
      icon: BarChart3, 
      action: () => navigate('/timesheets'), 
      color: 'from-orange-500 to-orange-600',
      shortcut: 'R'
    },
  ];

  const stats = [
    {
      title: 'Total Employees',
      value: activeLoading ? '...' : Math.round(activeData?.employeeCount || 0),
      description: 'Active staff members',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      textColor: 'text-blue-700 dark:text-blue-400',
      change: 0, // Employee count doesn't change frequently
    },
    {
      title: `${getPeriodLabel()} Hours`,
      value: activeLoading ? '...' : (activeData?.totalHours?.toFixed(1) || '0.0'),
      description: 'Hours worked',
      icon: Clock,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      textColor: 'text-green-700 dark:text-green-400',
      change: getPercentageChange(activeData?.totalHours || 0, previousData?.totalHours || 0),
    },
    {
      title: `${getPeriodLabel()} Payroll`,
      value: activeLoading ? '...' : `${(activeData?.totalPayroll?.toFixed(0) || '0')} LE`,
      description: 'Total earnings',
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      textColor: 'text-purple-700 dark:text-purple-400',
      change: getPercentageChange(activeData?.totalPayroll || 0, previousData?.totalPayroll || 0),
    },
    {
      title: `${getPeriodLabel()} Shifts`,
      value: activeLoading ? '...' : Math.round(activeData?.totalShifts || 0),
      description: 'Completed shifts',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      textColor: 'text-orange-700 dark:text-orange-400',
      change: getPercentageChange(activeData?.totalShifts || 0, previousData?.totalShifts || 0),
    }
  ];

  return (
    <PullToRefresh onRefresh={async () => window.location.reload()}>
      <div className="w-full px-3 sm:px-6 lg:px-8 pb-8">
        {/* Hero Header Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 sm:p-8 mb-8">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    {t('dashboard') || 'Dashboard'}
                  </h1>
                  <Badge variant="secondary" className="animate-pulse">
                    Live
                  </Badge>
                </div>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                  Real-time insights into your workforce performance and business metrics
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-4 w-4" />
                    <span>{activeData?.employeeCount || 0} Active Employees</span>
                  </div>
                </div>
          </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-44 bg-background/80 backdrop-blur-sm border-border/50">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Period</SelectItem>
                  <SelectItem value="previous">Previous Period</SelectItem>
                  <SelectItem value="custom">Custom Month</SelectItem>
                </SelectContent>
              </Select>
              {selectedPeriod === 'custom' && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-40 bg-background/80 backdrop-blur-sm border-border/50">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-2">2 Months Ago</SelectItem>
                    <SelectItem value="-1">Last Month</SelectItem>
                    <SelectItem value="0">This Month</SelectItem>
                  </SelectContent>
                </Select>
              )}
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

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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
                {stat.change !== 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    vs. previous period
                  </p>
                )}
                </CardContent>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                   style={{ background: `linear-gradient(90deg, transparent, ${stat.color.split(' ')[1]}/0.2, transparent)` }} />
            </Card>
          ))}
        </div>

        {/* Quick Actions - Modern Card Grid */}
        <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-card to-card/90 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <p className="text-muted-foreground mt-1">Streamline your workflow with one-click actions</p>
          </div>
              <Badge variant="outline" className="text-xs">
                4 Actions
              </Badge>
        </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="group h-auto min-h-[120px] p-4 flex flex-col items-center justify-center space-y-3 hover:bg-transparent transition-all duration-300 text-center relative overflow-hidden border border-border/50 hover:border-primary/30 rounded-2xl"
                  onClick={action.action}
                >
                  {/* Background gradient on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`} />
                  
                  <div className={`relative z-10 p-3 rounded-2xl bg-gradient-to-br ${action.color} text-white shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  
                  <div className="relative z-10 space-y-1 text-center w-full">
                    <div className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors duration-300">
                      {action.title}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {action.description}
                    </div>
                    <Badge variant="secondary" className="text-[10px] mt-2">
                      {action.shortcut}
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Unified Analytics - Replace individual chart components */}
        <DashboardCharts
          timePeriod="month"
          dateRange={activePeriod}
        />

        {/* Welcome Message */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-2">
                  Welcome to ChampTime HRM System. Everything is running smoothly.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                    <Activity className="h-3 w-3 mr-1" />
                    System Online
                  </Badge>
                  <Badge variant="outline" className="text-primary border-border bg-muted/50">
                    Last Updated: {new Date().toLocaleTimeString()}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PullToRefresh>
  );
};

export default DashboardPage;