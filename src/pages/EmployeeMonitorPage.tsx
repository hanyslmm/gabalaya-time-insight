import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Clock, Users, Activity, RefreshCw, MapPin, ExternalLink } from 'lucide-react';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

interface EmployeeStatus {
  employee_name: string;
  clock_in_time: string;
  clock_in_date: string;
  clock_in_location?: string;
  clock_out_time?: string;
  clock_out_date?: string;
  clock_out_location?: string;
  duration_minutes?: number;
  is_active: boolean;
}

interface Employee {
  staff_id: string;
  full_name: string;
  role: string;
}

const EmployeeMonitorPage: React.FC = () => {
  const { user } = useAuth();
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      // Set up real-time updates
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setRefreshing(true);
      
      // Fetch all employees (only for admins)
      let employeesData = [];
      if (isAdmin) {
        const { data, error: employeesError } = await supabase
          .from('employees')
          .select('staff_id, full_name, role');

        if (employeesError) throw employeesError;
        employeesData = data || [];
      }

      // Fetch today's timesheet entries
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (timesheetError) throw timesheetError;

      setEmployees(employeesData);

      // Process employee statuses
      const statusMap = new Map<string, EmployeeStatus>();
      
      timesheetData?.forEach(entry => {
        const isActive = !entry.clock_out_time || entry.clock_out_time === '00:00:00';
        const duration = isActive 
          ? differenceInMinutes(new Date(), new Date(`${entry.clock_in_date}T${entry.clock_in_time}`))
          : entry.total_hours ? entry.total_hours * 60 : 0;

        if (!statusMap.has(entry.employee_name) || isActive) {
          statusMap.set(entry.employee_name, {
            employee_name: entry.employee_name,
            clock_in_time: entry.clock_in_time,
            clock_in_date: entry.clock_in_date,
            clock_in_location: entry.clock_in_location,
            clock_out_time: entry.clock_out_time,
            clock_out_date: entry.clock_out_date,
            clock_out_location: entry.clock_out_location,
            duration_minutes: duration,
            is_active: isActive
          });
        }
      });

      setEmployeeStatuses(Array.from(statusMap.values()));
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load employee status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const openLocationInMaps = (location: string) => {
    if (!location) return;
    const [lat, lng] = location.split(', ').map(coord => parseFloat(coord.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
  };

  const activeEmployees = employeeStatuses.filter(status => status.is_active);
  const completedToday = employeeStatuses.filter(status => !status.is_active);

  // Allow both admin and employee access, but with different features
  const isAdmin = user?.role === 'admin';
  
  if (!user) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Please log in to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? 'Employee Monitor' : 'Team Status'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin 
              ? 'Real-time tracking of employee clock-in/out status for today'
              : 'See who is currently working with you today'
            }
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={fetchData}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Active</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees.length}</div>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Employees clocked in' : 'Team members active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">Shifts completed</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{employees.length}</div>
              <p className="text-xs text-muted-foreground">Registered employees</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Employees */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span>Currently Active ({activeEmployees.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeEmployees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No employees currently clocked in</p>
          ) : (
            <div className="space-y-4">
              {activeEmployees.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src="" alt={status.employee_name} />
                        <AvatarFallback>
                          {status.employee_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="font-medium">{status.employee_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Clocked in at {status.clock_in_time}
                      </p>
                      {status.clock_in_location && (
                        <div className="flex items-center space-x-1 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Location</span>
                          <button
                            onClick={() => openLocationInMaps(status.clock_in_location!)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                    <p className="text-sm font-medium mt-2">
                      {status.duration_minutes ? formatDuration(status.duration_minutes) : '0h 0m'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Shifts Today ({completedToday.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {completedToday.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No completed shifts today</p>
          ) : (
            <div className="space-y-4">
              {completedToday.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src="" alt={status.employee_name} />
                      <AvatarFallback>
                        {status.employee_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{status.employee_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {status.clock_in_time} - {status.clock_out_time}
                      </p>
                      <div className="flex space-x-4 mt-1">
                        {status.clock_in_location && (
                          <button
                            onClick={() => openLocationInMaps(status.clock_in_location!)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <MapPin className="h-3 w-3" />
                            <span>In</span>
                          </button>
                        )}
                        {status.clock_out_location && (
                          <button
                            onClick={() => openLocationInMaps(status.clock_out_location!)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <MapPin className="h-3 w-3" />
                            <span>Out</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">
                      Completed
                    </Badge>
                    <p className="text-sm font-medium mt-2">
                      {status.duration_minutes ? formatDuration(status.duration_minutes) : '0h 0m'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeMonitorPage;