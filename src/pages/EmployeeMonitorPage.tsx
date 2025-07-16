import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Users } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';
import { EmployeeSummaryCards } from '@/components/EmployeeSummaryCards';
import { ActiveEmployeesList } from '@/components/ActiveEmployeesList';
import { CompletedShiftsList } from '@/components/CompletedShiftsList';

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
      
      // Fetch all employees to map IDs to names
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('staff_id, full_name, role');

      if (employeesError) throw employeesError;

      // Create a comprehensive map to convert employee IDs/names to display names
      const employeeMap = new Map();
      (employeesData || []).forEach(emp => {
        // Map staff_id to full_name (primary mapping)
        employeeMap.set(emp.staff_id, emp.full_name);
        // Map full_name to itself (for consistency)
        employeeMap.set(emp.full_name, emp.full_name);
      });

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

        // Map employee ID/name to display name, check both employee_name and employee_id
        let displayName = entry.employee_name;
        
        // First try to map employee_name (might be staff_id like EMP184446)
        if (employeeMap.has(entry.employee_name)) {
          displayName = employeeMap.get(entry.employee_name);
        }
        // Then try employee_id if available
        else if (entry.employee_id && employeeMap.has(entry.employee_id)) {
          displayName = employeeMap.get(entry.employee_id);
        }
        // If neither works, check if it's already a full name
        else {
          // Find by staff_id matching the employee_name pattern
          const foundEmployee = (employeesData || []).find(emp => 
            emp.staff_id === entry.employee_name || emp.full_name === entry.employee_name
          );
          if (foundEmployee) {
            displayName = foundEmployee.full_name;
          }
        }

        if (!statusMap.has(displayName) || isActive) {
          statusMap.set(displayName, {
            employee_name: displayName,
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
    const mins = Math.round(minutes % 60);
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
      <div className="w-full px-4 sm:px-6 lg:px-8">
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
    <div className="w-full px-4 sm:px-6 lg:px-8">
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

      <EmployeeSummaryCards
        activeCount={activeEmployees.length}
        completedCount={completedToday.length}
        totalEmployees={employees.length}
        isAdmin={isAdmin}
      />

      <ActiveEmployeesList
        activeEmployees={activeEmployees}
        onLocationClick={openLocationInMaps}
        formatDuration={formatDuration}
      />

      <CompletedShiftsList
        completedShifts={completedToday}
        onLocationClick={openLocationInMaps}
        formatDuration={formatDuration}
      />
    </div>
  );
};

export default EmployeeMonitorPage;