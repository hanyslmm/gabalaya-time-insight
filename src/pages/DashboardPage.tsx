import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Clock, DollarSign, TrendingUp, Upload, Download, Settings } from 'lucide-react';
import WeeklyHoursTrend from '@/components/WeeklyHoursTrend';
import MonthlyShiftsActivity from '@/components/MonthlyShiftsActivity';
import DailyPaymentChart from '@/components/DailyPaymentChart';
import TopPerformersLeaderboard from '@/components/TopPerformersLeaderboard';
import { useDashboardData } from '@/hooks/useDashboardData';
import PullToRefresh from '@/components/PullToRefresh';
import ProfileAvatar from '@/components/ProfileAvatar';
import GlobalSearch from '@/components/GlobalSearch';
import { ThemeToggle } from '@/components/ThemeToggle';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const quickActions = [
    { title: 'Import Timesheets', description: 'Upload CSV or Excel files', icon: Upload, action: () => navigate('/timesheets'), color: 'bg-blue-500' },
    { title: 'Export Data', description: 'Download payroll reports', icon: Download, action: () => navigate('/timesheets'), color: 'bg-green-500' },
    { title: 'Employee Monitor', description: 'Real-time clock-in status', icon: Users, action: () => navigate('/monitor'), color: 'bg-purple-500' },
    { title: 'Manage Employees', description: 'Add, edit, or view employees', icon: Users, action: () => navigate('/employees'), color: 'bg-purple-500' },
    { title: 'Settings', description: 'Configure wage rates', icon: Settings, action: () => navigate('/settings'), color: 'bg-gray-500' }
  ];

  return (
    <PullToRefresh onRefresh={async () => window.location.reload()}>
      <div className="w-full px-2 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 space-y-3 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t('dashboard') || 'Dashboard'}</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">Overview of your HRM system</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40 sm:w-48">
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
                  <SelectTrigger className="w-36 sm:w-40">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="group bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold text-card-foreground/80">Total Employees</CardTitle>
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors"><Users className="h-4 w-4 text-primary" /></div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{activeLoading ? '...' : Math.round(activeData?.employeeCount || 0)}</div>
                    <p className="text-xs text-muted-foreground">Active staff members</p>
                </CardContent>
            </Card>
            <Card className="group bg-gradient-to-br from-card via-card to-secondary/5 border-secondary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold text-card-foreground/80">{getPeriodLabel()} Hours</CardTitle>
                    <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors"><Clock className="h-4 w-4 text-secondary" /></div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{activeLoading ? '...' : (activeData?.totalHours?.toFixed(1) || '0.0')}</div>
                    <p className="text-xs text-muted-foreground">Hours worked</p>
                </CardContent>
            </Card>
            <Card className="group bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold text-card-foreground/80">{getPeriodLabel()} Payroll</CardTitle>
                    <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors"><DollarSign className="h-4 w-4 text-accent" /></div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-accent mb-1">{activeLoading ? '...' : (activeData?.totalPayroll?.toFixed(2) || '0.00')} LE</div>
                    <p className="text-xs text-muted-foreground">Total earnings</p>
                </CardContent>
            </Card>
            <Card className="group bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold text-card-foreground/80">{getPeriodLabel()} Shifts</CardTitle>
                    <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors"><TrendingUp className="h-4 w-4 text-success" /></div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-success mb-1">{activeLoading ? '...' : Math.round(activeData?.totalShifts || 0)}</div>
                    <p className="text-xs text-muted-foreground">Completed shifts</p>
                </CardContent>
            </Card>
        </div>

        {/* Charts */}
        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyHoursTrend timePeriod={selectedPeriod} dateRange={{...activePeriod, label: getPeriodLabel()}} />
            <MonthlyShiftsActivity timePeriod={selectedPeriod} dateRange={{...activePeriod, label: getPeriodLabel()}} />
          </div>
          <DailyPaymentChart timePeriod={selectedPeriod} dateRange={{...activePeriod, label: getPeriodLabel()}} />
          <TopPerformersLeaderboard timePeriod={selectedPeriod} dateRange={{...activePeriod, label: getPeriodLabel()}} />
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto min-h-[120px] p-4 flex flex-col items-center justify-center space-y-3 hover:bg-accent/10 transition-all duration-300"
                  onClick={action.action}
                >
                  <div className={`p-3 rounded-xl ${action.color} text-white shadow-lg`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="font-semibold text-sm leading-tight">{action.title}</div>
                    <div className="text-xs text-muted-foreground leading-tight">{action.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Welcome to the Gabalaya Finance HRM System. Use the navigation menu to manage employees, timesheets, and system settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </PullToRefresh>
  );
};

export default DashboardPage;