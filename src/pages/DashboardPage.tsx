import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

  // Pay period calculation (28th-based)
  const calculatePayPeriod = (baseDate: Date, endDay: number = 28, offsetMonths: number = 0) => {
    const targetDate = new Date(baseDate);
    targetDate.setMonth(targetDate.getMonth() + offsetMonths);
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    // For current period, use current month 1st to current date
    if (offsetMonths === 0) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(); // Today
      return { from: startDate, to: endDate };
    }
    
    // For previous period, use previous month full month
    if (offsetMonths === -1) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0); // Last day of the month
      return { from: startDate, to: endDate };
    }
    
    // For other periods, use full month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return { from: startDate, to: endDate };
  };

  // Handle month selection
  const getMonthPeriod = (monthOffset: number) => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    return { from: targetDate, to: endDate };
  };

  // Calculate periods
  const currentPeriod = calculatePayPeriod(new Date());
  const previousPeriod = calculatePayPeriod(new Date(), 28, -1);

  // Determine which period to use based on selection
  const getActivePeriod = () => {
    if (selectedPeriod === 'current') return currentPeriod;
    if (selectedPeriod === 'previous') return previousPeriod;
    if (selectedMonth) {
      const monthOffset = parseInt(selectedMonth);
      return getMonthPeriod(monthOffset);
    }
    return currentPeriod;
  };

  const activePeriod = getActivePeriod();

  // Fetch data for the active period
  const { data: activeData, isLoading: activeLoading } = useDashboardData(activePeriod);

  const quickActions = [
    {
      title: 'Import Timesheets',
      description: 'Upload timesheet data from CSV or Excel files',
      icon: Upload,
      action: () => navigate('/timesheets'),
      color: 'bg-blue-500'
    },
    {
      title: 'Export Data',
      description: 'Download timesheet reports and payroll data',
      icon: Download,
      action: () => navigate('/timesheets'),
      color: 'bg-green-500'
    },
    {
      title: 'Employee Monitor',
      description: 'Real-time monitoring of employee clock-in/out status',
      icon: Users,
      action: () => navigate('/monitor'),
      color: 'bg-purple-500'
    },
    {
      title: 'Manage Employees',
      description: 'Add, edit, or view employee information',
      icon: Users,
      action: () => navigate('/employees'),
      color: 'bg-purple-500'
    },
    {
      title: 'Settings',
      description: 'Configure wage rates and system settings',
      icon: Settings,
      action: () => navigate('/settings'),
      color: 'bg-gray-500'
    }
  ];

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

  return (
    <PullToRefresh onRefresh={async () => window.location.reload()}>
      <div className="w-full px-2 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 space-y-3 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{t('dashboard')}</h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-600">Monitor your business performance</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Active Employees
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getPeriodLabel()}
                    </Badge>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {activeLoading ? '...' : activeData?.employeeCount || 0}
                  </p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total Hours
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getPeriodLabel()}
                    </Badge>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {activeLoading ? '...' : (activeData?.totalHours?.toFixed(1) || '0.0')}
                  </p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total Payroll
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getPeriodLabel()}
                    </Badge>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    ${activeLoading ? '...' : (activeData?.totalPayroll?.toFixed(2) || '0.00')}
                  </p>
                </div>
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total Shifts
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getPeriodLabel()}
                    </Badge>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {activeLoading ? '...' : activeData?.totalShifts || 0}
                  </p>
                </div>
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              </div>
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
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto min-h-[120px] p-4 flex flex-col items-center justify-center space-y-3 hover:bg-accent/10 transition-all duration-300"
                    onClick={action.action}
                  >
                    <div className={`p-3 rounded-xl ${action.color} text-white shadow-lg`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 text-center">
                      <div className="font-semibold text-sm leading-tight">{action.title}</div>
                      <div className="text-xs text-muted-foreground leading-tight">{action.description}</div>
                    </div>
                  </Button>
                );
              })}
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