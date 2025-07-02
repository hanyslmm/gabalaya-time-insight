
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Clock, DollarSign, TrendingUp, Upload, Download, Settings } from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';

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
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard') || 'Dashboard'}</h1>
        <p className="mt-2 text-sm text-gray-600">Overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timesheetSummary?.totalHours.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">{timesheetSummary?.totalPayroll.toFixed(2) || '0.00'} LE</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timesheetSummary?.totalShifts || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and navigation shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-gray-50"
                  onClick={action.action}
                >
                  <div className={`p-2 rounded-full ${action.color} text-white`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{action.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{action.description}</div>
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
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Welcome to the Gabalaya Finance HRM System. Use the navigation menu to manage employees, timesheets, and system settings.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-500">• Click "Import Timesheets" to upload timesheet data</p>
            <p className="text-sm text-gray-500">• Use "Export Data" to download reports</p>
            <p className="text-sm text-gray-500">• Navigate to Timesheets page for full import/export functionality</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
