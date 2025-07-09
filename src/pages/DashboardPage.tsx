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
import MonthlyHoursTrend from '@/components/MonthlyHoursTrend';
import MonthlyShiftsActivity from '@/components/MonthlyShiftsActivity';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Default to current period for data loading

  // Get current date range for default data loading
  const now = new Date();
  const dateRange = {
    from: startOfMonth(now),
    to: endOfMonth(now),
    label: 'Current Pay Period'
  };

  // Fetch employee count
  const { data: employeeCount } = useQuery({
    queryKey: ['employee-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch timesheet summary with date filtering
  const { data: timesheetSummary } = useQuery({
    queryKey: ['timesheet-summary', dateRange],
    queryFn: async () => {
      const query = supabase
        .from('timesheet_entries')
        .select('total_hours, total_card_amount_flat')
        .gte('clock_in_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('clock_in_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const totalHours = data?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
      const totalPayroll = data?.reduce((sum, entry) => sum + (entry.total_card_amount_flat || 0), 0) || 0;
      const totalShifts = data?.length || 0;
      
      return { totalHours, totalPayroll, totalShifts };
    }
  });

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
    <div className="px-4 sm:px-6 lg:px-8">
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
                  <Card className="group bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] cursor-pointer rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-card-foreground/80 leading-relaxed">Total Employees</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{Math.round(employeeCount || 0)}</div>
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
                      <div className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{Math.round(timesheetSummary?.totalHours || 0)}</div>
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
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-accent mb-1">{Math.round(timesheetSummary?.totalPayroll || 0)} LE</div>
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
                      <div className="text-2xl sm:text-3xl font-bold text-success mb-1">{Math.round(timesheetSummary?.totalShifts || 0)}</div>
                      <p className="text-xs text-muted-foreground">Completed shifts</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts and Analytics Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Main Charts */}
                  <div className="xl:col-span-2 space-y-6">
                    <DashboardCharts timePeriod="current" dateRange={dateRange} />
                  </div>
                  
                  {/* Leaderboard */}
                  <div className="xl:col-span-1">
                    <TopPerformersLeaderboard timePeriod="current" dateRange={dateRange} />
                  </div>
                </div>

                {/* Additional Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MonthlyHoursTrend timePeriod="current" dateRange={dateRange} />
                  <MonthlyShiftsActivity timePeriod="current" dateRange={dateRange} />
                </div>

                {/* Daily Payment Chart */}
                <div>
                  <DailyPaymentChart timePeriod="current" dateRange={dateRange} />
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
                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{Math.round(employeeCount || 0)}</div>
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
                      <div className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{Math.round(timesheetSummary?.totalHours || 0)}</div>
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
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-accent mb-1">{Math.round(timesheetSummary?.totalPayroll || 0)} LE</div>
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
                      <div className="text-2xl sm:text-3xl font-bold text-success mb-1">{Math.round(timesheetSummary?.totalShifts || 0)}</div>
                      <p className="text-xs text-muted-foreground">Completed shifts</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts and Analytics Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Main Charts */}
                  <div className="xl:col-span-2 space-y-6">
                    <DashboardCharts timePeriod="previous" dateRange={dateRange} />
                  </div>
                  
                  {/* Leaderboard */}
                  <div className="xl:col-span-1">
                    <TopPerformersLeaderboard timePeriod="previous" dateRange={dateRange} />
                  </div>
                </div>

                {/* Additional Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MonthlyHoursTrend timePeriod="previous" dateRange={dateRange} />
                  <MonthlyShiftsActivity timePeriod="previous" dateRange={dateRange} />
                </div>

                {/* Daily Payment Chart */}
                <div>
                  <DailyPaymentChart timePeriod="previous" dateRange={dateRange} />
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
                  className="h-auto min-h-[140px] p-4 sm:p-6 flex flex-col items-center justify-center space-y-4 hover:bg-accent/10 hover:border-accent/50 border-border/30 transition-all duration-300 hover:shadow-lg hover:scale-105 text-center group rounded-xl bg-gradient-to-br from-background/80 to-primary/5"
                  onClick={action.action}
                >
                  <div className={`p-3 sm:p-4 rounded-xl ${action.color} text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="space-y-2 text-center w-full max-w-[120px]">
                    <div className="font-semibold text-sm sm:text-base leading-snug text-card-foreground group-hover:text-primary transition-colors break-words">
                      {action.title}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words hyphens-auto line-clamp-3">
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
