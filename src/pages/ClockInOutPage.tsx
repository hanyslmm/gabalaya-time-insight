import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, MapPin, AlertCircle, RefreshCw, Users, Eye, EyeOff } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';
import ProfileAvatar from '@/components/ProfileAvatar';

// Defines the structure for a clock-in/out entry
interface ClockEntry {
  id: string;
  employee_name: string;
  clock_in_time: string;
  clock_in_date: string;
  clock_out_time: string | null;
  clock_out_date: string | null;
  clock_in_location: string | null;
  total_hours: number | null;
}

// Defines the structure for team member status
interface TeamMemberStatus {
  employee_name: string;
  clock_in_time: string;
  clock_in_date: string;
  clock_in_location?: string;
  duration_minutes: number;
  is_active: boolean;
}

const ClockInOutPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true); // For initial page load
  const [actionLoading, setActionLoading] = useState(false); // For button clicks
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
  const [showTeamStatus, setShowTeamStatus] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [motivationalMessage, setMotivationalMessage] = useState('');

  // Fetch motivational message on component mount
  useEffect(() => {
    const fetchMessage = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('motivational_message')
        .single();
      
      if (data?.motivational_message) {
        setMotivationalMessage(data.motivational_message);
      }
    };
    fetchMessage();
  }, []);

  // Get user's current geolocation
  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation is not supported by your browser');
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            resolve(`${latitude}, ${longitude}`);
          },
          () => {
            reject('Unable to retrieve your location');
          }
        );
      }
    });
  };

  // Fetch team status (other employees' clock-in status)
  const fetchTeamStatus = async () => {
    if (!user) return;

    try {
      // Fetch all employees to map IDs to names
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('staff_id, full_name, role');

      if (employeesError) throw employeesError;

      // Create a comprehensive map to convert employee IDs/names to display names
      const employeeMap = new Map();
      (employeesData || []).forEach(emp => {
        employeeMap.set(emp.staff_id, emp.full_name);
        employeeMap.set(emp.full_name, emp.full_name);
      });

      // Fetch today's timesheet entries for all employees
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (timesheetError) throw timesheetError;

      // Process team member statuses
      const statusMap = new Map<string, TeamMemberStatus>();
      
      timesheetData?.forEach(entry => {
        const isActive = !entry.clock_out_time || entry.clock_out_time === '00:00:00';
        const duration = isActive 
          ? differenceInMinutes(new Date(), new Date(`${entry.clock_in_date}T${entry.clock_in_time}`))
          : entry.total_hours ? entry.total_hours * 60 : 0;

        // Map employee ID/name to display name
        let displayName = entry.employee_name;
        
        if (employeeMap.has(entry.employee_name)) {
          displayName = employeeMap.get(entry.employee_name);
        } else if (entry.employee_id && employeeMap.has(entry.employee_id)) {
          displayName = employeeMap.get(entry.employee_id);
        } else {
          const foundEmployee = (employeesData || []).find(emp => 
            emp.staff_id === entry.employee_name || emp.full_name === entry.employee_name
          );
          if (foundEmployee) {
            displayName = foundEmployee.full_name;
          }
        }

        // Skip current user from team status
        if (displayName === user.full_name || entry.employee_name === user.username) {
          return;
        }

        // Only show active entries or update with active entry if exists
        if (!statusMap.has(displayName) || isActive) {
          statusMap.set(displayName, {
            employee_name: displayName,
            clock_in_time: entry.clock_in_time,
            clock_in_date: entry.clock_in_date,
            clock_in_location: entry.clock_in_location,
            duration_minutes: duration,
            is_active: isActive
          });
        }
      });

      // Only show active team members
      const activeTeamMembers = Array.from(statusMap.values()).filter(status => status.is_active);
      setTeamStatus(activeTeamMembers);
    } catch (error) {
      console.error('Error fetching team status:', error);
    }
  };

  // Fetch today's clock-in/out entries
  const fetchTodayEntries = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // First, get the user's employee record to understand all possible identifiers
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('staff_id, full_name, username, email')
        .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name},username.eq.${user.username},email.eq.${user.email}`)
        .limit(1);

      if (employeeError) {
        console.error('Error fetching employee data:', employeeError);
      }

      // Build a comprehensive list of possible identifiers for this user
      const userIdentifiers = [
        user.username,
        user.full_name,
        user.email
      ];

      // Add identifiers from employee record if found
      if (employeeData && employeeData.length > 0) {
        const emp = employeeData[0];
        if (emp.staff_id && !userIdentifiers.includes(emp.staff_id)) {
          userIdentifiers.push(emp.staff_id);
        }
        if (emp.full_name && !userIdentifiers.includes(emp.full_name)) {
          userIdentifiers.push(emp.full_name);
        }
        if (emp.username && !userIdentifiers.includes(emp.username)) {
          userIdentifiers.push(emp.username);
        }
        if (emp.email && !userIdentifiers.includes(emp.email)) {
          userIdentifiers.push(emp.email);
        }
      }

      // Filter out null/undefined values
      const validIdentifiers = userIdentifiers.filter(id => id && id.trim() !== '');
      
      console.log('Searching for entries with identifiers:', validIdentifiers);

      // Build OR query for all possible identifiers
      const orQuery = validIdentifiers.map(id => `employee_name.eq.${id}`).join(',');
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .or(orQuery)
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error);
        toast.error("Could not fetch today's entries.");
        return;
      }

      setTodayEntries(data || []);
      
      // Find the most recent entry without clock_out_time (active entry)
      const activeEntry = data?.find(entry => !entry.clock_out_time && entry.clock_out_time !== '00:00:00') || null;
      setCurrentEntry(activeEntry);
      
      // Enhanced debug logging
      console.log('User info:', { 
        username: user.username, 
        full_name: user.full_name, 
        email: user.email,
        identifiers: validIdentifiers 
      });
      console.log('Today entries found:', data);
      console.log('Active entry:', activeEntry);
      console.log('Current entry state will be set to:', activeEntry);
      
    } catch (error) {
      console.error('Error fetching today entries:', error);
      toast.error("Could not fetch today's entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTodayEntries();
      fetchTeamStatus();
      
      // Set up interval to refresh team status every 30 seconds
      const interval = setInterval(fetchTeamStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleClockIn = async () => {
    if (!user) {
      toast.error('Please log in to clock in');
      return;
    }

    // Check if user is already clocked in
    if (currentEntry) {
      toast.info('You are already clocked in. Please clock out first.');
      return;
    }

    setActionLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);

      // Try to get the correct staff_id from the employee record
      const { data: employeeData } = await supabase
        .from('employees')
        .select('staff_id, full_name, username')
        .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name},username.eq.${user.username}`)
        .limit(1);

      // Use staff_id if found, otherwise fallback to username
      const staffId = employeeData && employeeData.length > 0 ? employeeData[0].staff_id : user.username;

      console.log('Attempting clock in with staff_id:', staffId);

      const { data, error } = await supabase.rpc('clock_in', {
        p_staff_id: staffId,
        p_clock_in_location: userLocation,
      });

      if (error) {
        // If the error is about already being clocked in, refresh the entries to show the current state
        if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('clocked in')) {
          console.log('Clock in error - user already clocked in, refreshing data...');
          
          // Refresh the data and check the result directly
          const today = new Date().toISOString().split('T')[0];
          try {
            // Get the user's employee record for comprehensive search
            const { data: employeeData } = await supabase
              .from('employees')
              .select('staff_id, full_name, username, email')
              .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name},username.eq.${user.username},email.eq.${user.email}`)
              .limit(1);

            // Build comprehensive identifier list
            const userIdentifiers = [user.username, user.full_name, user.email];
            if (employeeData && employeeData.length > 0) {
              const emp = employeeData[0];
              [emp.staff_id, emp.full_name, emp.username, emp.email].forEach(id => {
                if (id && !userIdentifiers.includes(id)) {
                  userIdentifiers.push(id);
                }
              });
            }

            const validIdentifiers = userIdentifiers.filter(id => id && id.trim() !== '');
            const orQuery = validIdentifiers.map(id => `employee_name.eq.${id}`).join(',');
            
            const { data: refreshedData, error: refreshError } = await supabase
              .from('timesheet_entries')
              .select('*')
              .or(orQuery)
              .eq('clock_in_date', today)
              .order('clock_in_time', { ascending: false });

            if (!refreshError && refreshedData) {
              setTodayEntries(refreshedData);
              const activeEntry = refreshedData.find(entry => !entry.clock_out_time && entry.clock_out_time !== '00:00:00') || null;
              setCurrentEntry(activeEntry);
              
              console.log('Refreshed data:', refreshedData);
              console.log('Found active entry:', activeEntry);
              
              if (activeEntry) {
                toast.info('You are already clocked in. The page has been refreshed to show your current status.');
              } else {
                toast.warning('No active clock-in found. You may need to clock in again.');
              }
            } else {
              toast.error('Unable to refresh your status. Please try again.');
            }
          } catch (refreshError) {
            console.error('Error refreshing data:', refreshError);
            toast.error('Unable to refresh your status. Please try again.');
          }
          return;
        }
        throw new Error(error.message);
      }
      
      await fetchTodayEntries();
      await fetchTeamStatus(); // Refresh team status after clock in
      toast.success('Clocked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
      console.error('Clock-in error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentEntry) {
      toast.error('No active clock-in found');
      return;
    }

    setActionLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);

      const { error } = await supabase.rpc('clock_out', {
        p_entry_id: currentEntry.id,
        p_clock_out_location: userLocation
      });

      if (error) throw new Error(error.message);
      
      await fetchTodayEntries();
      await fetchTeamStatus(); // Refresh team status after clock out
      toast.success('Clocked out successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
      console.error('Clock-out error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const refreshData = async () => {
    await fetchTodayEntries();
    await fetchTeamStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 sm:px-6 lg:px-8 pb-safe">
      <div className="max-w-md mx-auto space-y-3 sm:space-y-6">
        {motivationalMessage && (
          <Alert variant="default" className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 rounded-2xl p-4">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground font-medium">
              {motivationalMessage}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl border-border/20 bg-gradient-to-br from-card to-card/90 rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-3 px-4 pt-6">
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                title="Refresh status"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="relative mb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
                <Clock className="h-8 w-8 text-primary-foreground" />
              </div>
              {currentEntry && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-card animate-pulse"></div>
              )}
            </div>
            <CardTitle className="text-lg sm:text-2xl lg:text-3xl font-bold mb-2">
              {currentEntry ? 'You are Clocked In' : 'Ready to Work?'}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">
              {format(new Date(), 'eeee, MMMM dd, yyyy')}
            </CardDescription>
            
            {/* Debug info - remove in production */}
            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/20 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div>User: {user?.username}</div>
                  <div>Name: {user?.full_name}</div>
                  <div>Email: {user?.email}</div>
                  <div>Role: {user?.role}</div>
                </div>
                <div>
                  <div>Current Entry: {currentEntry ? 'YES' : 'NO'}</div>
                  <div>Today Entries: {todayEntries.length}</div>
                  {currentEntry && (
                    <>
                      <div>Entry ID: {currentEntry.id}</div>
                      <div>Clock In: {currentEntry.clock_in_time}</div>
                      <div>Clock Out: {currentEntry.clock_out_time || 'N/A'}</div>
                      <div>Employee Name: {currentEntry.employee_name}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                <div className="text-xs">All Today's Entries:</div>
                {todayEntries.map((entry, index) => (
                  <div key={index} className="ml-2 text-xs">
                    {index + 1}. {entry.employee_name} | In: {entry.clock_in_time} | Out: {entry.clock_out_time || 'Active'}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-muted-foreground/20 flex justify-between items-center">
                <span className="text-xs">Having issues? Try manual refresh:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshData}
                  disabled={loading}
                  className="h-6 px-2 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Force Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            {currentEntry ? (
              <div className="text-center space-y-6">
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/20">
                  <p className="text-lg font-medium mb-2">
                    Clocked in at <span className="font-bold text-primary text-xl">{currentEntry.clock_in_time}</span>
                  </p>
                  {currentEntry.clock_in_location && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate max-w-48">{currentEntry.clock_in_location}</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  size="lg"
                  className="w-full h-14 bg-gradient-to-r from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive/80 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  {actionLoading ? 'Clocking Out...' : 'Clock Out'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                size="lg"
                className="w-full h-14 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                <LogIn className="mr-3 h-5 w-5" />
                {actionLoading ? 'Clocking In...' : 'Clock In'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Team Status Section */}
        <Card className="shadow-xl border-border/20 bg-gradient-to-br from-card to-card/90 rounded-2xl overflow-hidden">
          <CardHeader className="px-4 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Team Status</span>
                {teamStatus.length > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {teamStatus.length} active
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTeamStatus(!showTeamStatus)}
                className="h-8 px-2"
              >
                {showTeamStatus ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showTeamStatus && (
            <CardContent className="px-4 pb-4">
              {teamStatus.length === 0 ? (
                <div className="text-center py-4">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No team members currently active
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamStatus.map((member, index) => (
                    <div key={index} className="bg-gradient-to-r from-muted/30 to-muted/20 rounded-xl p-3 border border-border/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ProfileAvatar employeeName={member.employee_name} size="sm" />
                          <div>
                            <p className="font-medium text-sm">{member.employee_name}</p>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Since {member.clock_in_time}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                            {formatDuration(member.duration_minutes)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="shadow-xl border-border/20 bg-gradient-to-br from-card to-card/90 rounded-3xl overflow-hidden">
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-xl font-bold">Today's Entries</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {todayEntries.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  No entries for today yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <div key={entry.id} className="bg-gradient-to-r from-muted/30 to-muted/20 rounded-2xl p-4 border border-border/30">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center space-x-2">
                          <LogIn className="h-4 w-4 text-success" />
                          <span className="text-sm font-medium">In: {entry.clock_in_time}</span>
                        </div>
                        {entry.clock_out_time && (
                          <div className="flex items-center space-x-2">
                            <LogOut className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-medium">Out: {entry.clock_out_time}</span>
                          </div>
                        )}
                      </div>
                      {entry.total_hours !== null && (
                        <Badge variant="secondary" className="bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-primary/20 font-semibold">
                          {entry.total_hours.toFixed(2)}h
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClockInOutPage;
