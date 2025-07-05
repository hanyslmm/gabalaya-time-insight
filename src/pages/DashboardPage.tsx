
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Clock, DollarSign, TrendingUp, Upload, Download, Settings } from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';
import DailyPaymentChart from '@/components/DailyPaymentChart';
import TopPerformersLeaderboard from '@/components/TopPerformersLeaderboard';
import MonthlyHoursTrend from '@/components/MonthlyHoursTrend';
import MonthlyShiftsActivity from '@/components/MonthlyShiftsActivity';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  // Fetch timesheet summary
  const { data: timesheetSummary } = useQuery({
    queryKey: ['timesheet-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('total_hours, total_card_amount_flat');
      
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{Math.round(employeeCount || 0)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-secondary/5 border-secondary/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{Math.round(timesheetSummary?.totalHours || 0)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold text-accent">{Math.round(timesheetSummary?.totalPayroll || 0)} LE</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Shifts</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{Math.round(timesheetSummary?.totalShifts || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Main Charts */}
        <div className="xl:col-span-2 space-y-6">
          <DashboardCharts />
        </div>
        
        {/* Leaderboard */}
        <div className="xl:col-span-1">
          <TopPerformersLeaderboard />
        </div>
      </div>

      {/* Additional Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <MonthlyHoursTrend />
        <MonthlyShiftsActivity />
      </div>

      {/* Daily Payment Chart */}
      <div className="mb-8">
        <DailyPaymentChart />
      </div>

      {/* Quick Actions */}
      <Card className="mb-8 bg-gradient-to-br from-card via-card to-muted/5 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">Common tasks and navigation shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-accent/10 hover:border-accent border-border/50 transition-all duration-200 hover:shadow-lg text-center"
                  onClick={action.action}
                >
                  <div className={`p-3 rounded-full ${action.color} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 flex-1 flex flex-col justify-center">
                    <div className="font-medium text-xs leading-tight text-card-foreground">{action.title}</div>
                    <div className="text-xs text-muted-foreground leading-tight break-words">{action.description}</div>
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
