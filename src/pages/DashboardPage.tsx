import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MobileDropdownTabs from '@/components/MobileDropdownTabs';
import { Users, Clock, DollarSign, TrendingUp, Upload, Download, Settings } from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';
import DailyPaymentChart from '@/components/DailyPaymentChart';
import TopPerformersLeaderboard from '@/components/TopPerformersLeaderboard';
import WeeklyHoursTrend from '@/components/WeeklyHoursTrend';
import MonthlyShiftsActivity from '@/components/MonthlyShiftsActivity';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Default to current period for data loading

  // Pay period calculation (28th-based)
  const calculatePayPeriod = (baseDate: Date, endDay: number = 28, offsetMonths: number = 0) => {
    const targetDate = new Date(baseDate);
    targetDate.setMonth(targetDate.getMonth() + offsetMonths);
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    // Calculate the end date of the pay period
    let endDate = new Date(year, month, endDay);
    
    // For current period, if end day hasn't passed this month, use previous month's period
    if (offsetMonths === 0 && endDate > baseDate) {
      endDate.setMonth(month - 1);
    }
    
    // Start date is the day after the previous period's end
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(endDay + 1);
    
    return { from: startDate, to: endDate };
  };

  // Get current date range for default data loading using proper pay period calculation
  const now = new Date();
  const currentDateRange = {
    ...calculatePayPeriod(now, 28, 0),
    label: 'Current Pay Period'
  };

  const previousDateRange = {
    ...calculatePayPeriod(now, 28, -1),
    label: 'Previous Pay Period'
  };

  // Use optimized dashboard data hooks
  const { data: currentData, isLoading: currentLoading } = useDashboardData(currentDateRange, true);
  const { data: previousData, isLoading: previousLoading } = useDashboardData(previousDateRange, true);

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

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t('dashboard') || 'Dashboard'}</h1>
        <p className="mt-2 text-muted-foreground">Overview of your HRM system</p>
      </div>

      {/* Period Selection and Dashboard Content */}
      <MobileDropdownTabs
        defaultValue="current"
        tabs={[
          {
            value: "current",
            label: "Current Pay Period",
            content: (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <Card className="group bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden card-interactive">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-3 sm:p-4 lg:p-6">
                      <CardTitle className="text-fluid-sm font-semibold text-card-foreground/80 leading-snug line-clamp-2 min-w-0 flex-1 pr-2">Total Employees</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                      <div className="text-fluid-2xl font-bold text-primary mb-1 line-clamp-1">{currentLoading ? '...' : Math.round(currentData?.employeeCount || 0)}</div>
                      <p className="text-fluid-sm text-muted-foreground line-clamp-1">Active staff members</p>
                    </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-secondary/5 border-secondary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Hours</CardTitle>
                      <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                        <Clock className="h-4 w-4 text-secondary" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{currentLoading ? '...' : Math.round(currentData?.totalHours || 0)}</div>
                       <p className="text-xs text-muted-foreground">Hours worked</p>
                     </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Payroll</CardTitle>
                      <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                        <DollarSign className="h-4 w-4 text-accent" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-accent mb-1">{currentLoading ? '...' : Math.round(currentData?.totalPayroll || 0)} LE</div>
                       <p className="text-xs text-muted-foreground">Total earnings</p>
                     </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Shifts</CardTitle>
                      <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-2xl sm:text-3xl font-bold text-success mb-1">{currentLoading ? '...' : Math.round(currentData?.totalShifts || 0)}</div>
                       <p className="text-xs text-muted-foreground">Completed shifts</p>
                     </CardContent>
                  </Card>
                </div>

                {/* Charts and Analytics Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Main Charts */}
                  <div className="xl:col-span-2 space-y-6">
                    <DashboardCharts timePeriod="current" dateRange={currentDateRange} />
                  </div>
                  
                  {/* Leaderboard */}
                  <div className="xl:col-span-1">
                    <TopPerformersLeaderboard timePeriod="current" dateRange={currentDateRange} />
                  </div>
                </div>

                {/* Additional Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <WeeklyHoursTrend timePeriod="current" dateRange={currentDateRange} />
                   <MonthlyShiftsActivity timePeriod="current" dateRange={currentDateRange} />
                </div>

                {/* Daily Payment Chart */}
                <div>
                  <DailyPaymentChart timePeriod="current" dateRange={currentDateRange} />
                </div>
              </div>
            )
          },
          {
            value: "previous",
            label: "Previous Pay Period",
            content: (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <Card className="group bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Employees</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{previousLoading ? '...' : Math.round(previousData?.employeeCount || 0)}</div>
                      <p className="text-xs text-muted-foreground">Active staff members</p>
                    </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-secondary/5 border-secondary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Hours</CardTitle>
                      <div className="p-2 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                        <Clock className="h-4 w-4 text-secondary" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{previousLoading ? '...' : Math.round(previousData?.totalHours || 0)}</div>
                       <p className="text-xs text-muted-foreground">Hours worked</p>
                     </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Payroll</CardTitle>
                      <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                        <DollarSign className="h-4 w-4 text-accent" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-accent mb-1">{previousLoading ? '...' : Math.round(previousData?.totalPayroll || 0)} LE</div>
                       <p className="text-xs text-muted-foreground">Total earnings</p>
                     </CardContent>
                  </Card>

                  <Card className="group bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Shifts</CardTitle>
                      <div className="p-2 bg-success/10 rounded-lg group-hover:bg-success/20 transition-colors">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                    </CardHeader>
                     <CardContent className="p-4 sm:p-6 pt-0">
                       <div className="text-2xl sm:text-3xl font-bold text-success mb-1">{previousLoading ? '...' : Math.round(previousData?.totalShifts || 0)}</div>
                       <p className="text-xs text-muted-foreground">Completed shifts</p>
                     </CardContent>
                  </Card>
                </div>

                {/* Charts and Analytics Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Main Charts */}
                  <div className="xl:col-span-2 space-y-6">
                    <DashboardCharts timePeriod="previous" dateRange={previousDateRange} />
                  </div>
                  
                  {/* Leaderboard */}
                  <div className="xl:col-span-1">
                    <TopPerformersLeaderboard timePeriod="previous" dateRange={previousDateRange} />
                  </div>
                </div>

                {/* Additional Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <WeeklyHoursTrend timePeriod="previous" dateRange={previousDateRange} />
                   <MonthlyShiftsActivity timePeriod="previous" dateRange={previousDateRange} />
                </div>

                {/* Daily Payment Chart */}
                <div>
                  <DailyPaymentChart timePeriod="previous" dateRange={previousDateRange} />
                </div>
              </div>
            )
          }
        ]}
        className="mb-8"
      />

      {/* Quick Actions - Enhanced with better text wrapping */}
      <Card className="mb-8 bg-gradient-to-br from-card via-card to-muted/5 border-border/30 shadow-card hover:shadow-elegant transition-all duration-300 rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border/20">
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">Common tasks and navigation shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto min-h-[140px] sm:min-h-[160px] p-4 sm:p-6 flex flex-col items-center justify-center space-y-3 sm:space-y-4 hover:bg-accent/10 hover:border-accent/50 border-border/30 transition-all duration-300 hover:shadow-elegant hover:scale-105 text-center group rounded-xl bg-gradient-to-br from-background/80 to-primary/5 card-interactive"
                  onClick={action.action}
                >
                  <div className={`p-3 sm:p-4 rounded-xl ${action.color} text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 flex-shrink-0`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="space-y-2 text-center w-full min-w-0 flex-1">
                    <div className="font-semibold text-fluid-sm leading-snug text-card-foreground group-hover:text-primary transition-colors break-words-enhanced line-clamp-2">
                      {action.title}
                    </div>
                    <div className="text-fluid-sm text-muted-foreground leading-relaxed break-words-enhanced line-clamp-3">
                      {action.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Welcome to the Gabalaya Finance HRM System. Use the navigation menu to manage employees, timesheets, and system settings.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">• Click "Import Timesheets" to upload timesheet data</p>
            <p className="text-sm text-muted-foreground">• Use "Export Data" to download reports</p>
            <p className="text-sm text-muted-foreground">• Navigate to Timesheets page for full import/export functionality</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
