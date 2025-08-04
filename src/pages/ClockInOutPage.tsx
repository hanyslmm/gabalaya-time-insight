import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Clock, LogIn, LogOut, MapPin, AlertCircle, RefreshCw, Users, Eye, EyeOff, Coffee, Target, Zap, Calendar, Timer } from 'lucide-react';
import { format, differenceInMinutes, startOfDay, addHours } from 'date-fns';
import { toast } from 'sonner';
import ProfileAvatar from '@/components/ProfileAvatar';
import { getCurrentCompanyTime, getTodayInCompanyTimezone, formatInCompanyTimezone, getCompanyTimezone, validateTimezone } from '@/utils/timezoneUtils';
import { getTimezoneAbbreviation } from '@/utils/timeFormatter';

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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
  const [showTeamStatus, setShowTeamStatus] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [companyTime, setCompanyTime] = useState(new Date());
  const [workedHours, setWorkedHours] = useState(0);
  const [targetHours] = useState(8); // Default 8-hour workday
  const [showDebug, setShowDebug] = useState(false);
  const [timezoneAbbr, setTimezoneAbbr] = useState('Local');

  // Fetch motivational message and timezone info on component mount
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
    
    const fetchTimezoneInfo = async () => {
      try {
        // Validate timezone first
        const validation = await validateTimezone();
        console.log('Timezone validation result:', validation);
        
        if (!validation.isValid) {
          toast.error(`Timezone issue: ${validation.message}`);
        }
        
        const abbr = await getTimezoneAbbreviation();
        setTimezoneAbbr(abbr);
      } catch (error) {
        console.warn('Could not fetch timezone abbreviation:', error);
        setTimezoneAbbr('UTC+2'); // Fallback
      }
    };
    
    fetchMessage();
    fetchTimezoneInfo();
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
      const today = await getTodayInCompanyTimezone();
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (timesheetError) throw timesheetError;

      // Process team member statuses
      const statusMap = new Map<string, TeamMemberStatus>();
      const currentTime = await getCurrentCompanyTime();
      
      timesheetData?.forEach(entry => {
        // Fixed logic: Check for active entry more comprehensively
        const isActive = !entry.clock_out_time || 
                         entry.clock_out_time === null || 
                         entry.clock_out_time === '' ||
                         entry.clock_out_time === '00:00:00';
        const duration = isActive 
          ? differenceInMinutes(currentTime, new Date(`${entry.clock_in_date}T${entry.clock_in_time}`))
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
    
    const today = await getTodayInCompanyTimezone();
    
    try {
      // Build user identifiers for timesheet lookup
      const userIdentifiers = [
        user.username,
        user.full_name
      ];

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
      // Fixed logic: entry without clock_out_time OR with null/empty clock_out_time
      const activeEntry = data?.find(entry => 
        !entry.clock_out_time || 
        entry.clock_out_time === null || 
        entry.clock_out_time === '' ||
        entry.clock_out_time === '00:00:00'
      ) || null;
      setCurrentEntry(activeEntry);
      
      // Enhanced debug logging
      console.log('User info:', { 
        username: user.username, 
        full_name: user.full_name, 
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

  // Update current time and worked hours every second with error handling
  useEffect(() => {
    const updateTime = async () => {
      try {
        const utcNow = new Date();
        const companyNow = await getCurrentCompanyTime();
        setCurrentTime(utcNow);
        setCompanyTime(companyNow);
        
        // Calculate worked hours if clocked in
        if (currentEntry) {
          const clockInDateTime = new Date(`${currentEntry.clock_in_date}T${currentEntry.clock_in_time}`);
          const minutesWorked = differenceInMinutes(companyNow, clockInDateTime);
          setWorkedHours(minutesWorked / 60);
        }
      } catch (error) {
        console.error('Error updating time:', error);
        // Fallback to local time if company time fails
        const localNow = new Date();
        setCurrentTime(localNow);
        setCompanyTime(localNow);
      }
    };

    // Initial update
    updateTime();

    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [currentEntry]);

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
        .select('staff_id, full_name')
        .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name}`)
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
          const today = await getTodayInCompanyTimezone();
          try {
            // Build comprehensive identifier list
            const userIdentifiers = [user.username, user.full_name];

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
              // Fixed logic: entry without clock_out_time OR with null/empty clock_out_time
              const activeEntry = refreshedData.find(entry => 
                !entry.clock_out_time || 
                entry.clock_out_time === null || 
                entry.clock_out_time === '' ||
                entry.clock_out_time === '00:00:00'
              ) || null;
              setCurrentEntry(activeEntry);
              
              console.log('Refreshed data:', refreshedData);
                  console.log('Found active entry:', activeEntry);
                  
                  if (activeEntry) {
                    toast.success('✅ Status updated! You are currently clocked in.');
                  } else {
                    console.warn('❌ No active entry found after refresh. This might indicate a status sync issue.');
                    toast.error('⚠️ Status sync issue detected. Please try clocking in again or contact your administrator if this problem persists.');
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

  const getWorkDayProgress = () => {
    if (!currentEntry) return 0;
    return Math.min((workedHours / targetHours) * 100, 100);
  };

  const getTimeUntilTarget = () => {
    if (!currentEntry) return null;
    const remainingHours = Math.max(targetHours - workedHours, 0);
    const remainingMinutes = remainingHours * 60;
    return formatDuration(remainingMinutes);
  };

  const getGreeting = () => {
    const hour = companyTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-1 sm:px-2 lg:px-4 pb-safe min-h-screen animate-fade-in">
      <div className="max-w-md mx-auto space-y-3 sm:space-y-4">
        {/* Greeting Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10 animate-scale-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {getGreeting()}, {user?.full_name?.split(' ')[0] || user?.username}!
                </h2>
                <p className="text-sm text-muted-foreground">
                  {format(companyTime, 'eeee, MMMM dd • h:mm:ss a')} ({timezoneAbbr})
                </p>
                {showDebug && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Debug: UTC {new Date().toISOString()} | Local {new Date().toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-2xl">
                {currentEntry ? '🎯' : '☀️'}
              </div>
            </div>
          </CardContent>
        </Card>

        {motivationalMessage && (
          <Alert variant="default" className="bg-gradient-to-r from-accent/10 to-secondary/10 border-accent/20 rounded-2xl animate-slide-in-right">
            <Zap className="h-4 w-4 text-accent" />
            <AlertDescription className="text-foreground font-medium">
              {motivationalMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Clock In/Out Card */}
        <Card className="shadow-2xl border-border/20 bg-gradient-to-br from-card via-card/95 to-card/90 rounded-3xl overflow-hidden animate-scale-in">
          <CardHeader className="text-center pb-4 px-6 pt-8 relative">
            <div className="flex justify-between items-center mb-4">
              <Badge variant={currentEntry ? "default" : "secondary"} className="animate-pulse">
                {currentEntry ? "🟢 Active" : "⚪ Offline"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                className="h-8 w-8 p-0 opacity-60 hover:opacity-100 hover:scale-110 transition-all"
                title="Refresh status"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="relative mb-6">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                currentEntry 
                  ? 'bg-gradient-to-br from-success to-success/80 animate-pulse' 
                  : 'bg-gradient-to-br from-primary to-primary/80'
              }`}>
                <Clock className="h-10 w-10 text-white" />
              </div>
              {currentEntry && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full border-3 border-card animate-bounce">
                  <span className="block w-full h-full rounded-full bg-success animate-ping"></span>
                </div>
              )}
            </div>

            <CardTitle className="text-xl sm:text-3xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              {currentEntry ? '🎯 You\'re Working!' : '🚀 Ready to Start?'}
            </CardTitle>

            {/* Work Progress for Clocked In Users */}
            {currentEntry && (
              <div className="space-y-4 mb-6">
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Daily Progress</span>
                    <span className="text-sm font-bold text-primary">{workedHours.toFixed(1)}/{targetHours}h</span>
                  </div>
                  <Progress value={getWorkDayProgress()} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Timer className="h-3 w-3" />
                      <span>Since {currentEntry.clock_in_time}</span>
                    </div>
                    {getTimeUntilTarget() && (
                      <div className="flex items-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span>{getTimeUntilTarget()} remaining</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!currentEntry && (
              <CardDescription className="text-base text-muted-foreground mb-6">
                Tap the button below to start your workday
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {currentEntry ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-success/10 to-primary/10 rounded-2xl p-4 border border-success/20">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-success">
                      ⏰ Working for {formatDuration(workedHours * 60)}
                    </p>
                    {currentEntry.clock_in_location && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate max-w-48">📍 Clock-in location recorded</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  size="lg"
                  className="w-full h-16 bg-gradient-to-r from-destructive via-destructive/90 to-destructive/80 hover:from-destructive/80 hover:to-destructive/70 text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="mr-3 h-6 w-6 animate-spin" />
                      Clocking Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-3 h-6 w-6" />
                      Clock Out & Finish
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-4 border border-primary/10">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      💡 Your location will be recorded for attendance tracking
                    </p>
                    {showDebug && (
                      <div className="text-xs text-muted-foreground/70 bg-muted/20 p-2 rounded mt-2">
                        <p>Debug Info:</p>
                        <p>User: {user?.username} | Role: {user?.role}</p>
                        <p>Today's entries: {todayEntries.length}</p>
                        <p>Active entry: {currentEntry ? 'Found' : 'None'}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={handleClockIn}
                  disabled={actionLoading}
                  size="lg"
                  className="w-full h-16 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/80 hover:to-primary/70 text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="mr-3 h-6 w-6 animate-spin" />
                      Starting Work...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-3 h-6 w-6" />
                      Start My Workday
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug toggle */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs opacity-30 hover:opacity-60"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
        </div>

        {/* Debug info - hidden by default */}
        {showDebug && (
          <Card className="bg-muted/20 border-muted animate-fade-in">
            <CardHeader>
              <CardTitle className="text-sm">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div>User: {user?.username}</div>
                  <div>Name: {user?.full_name}</div>
                  <div>Role: {user?.role}</div>
                </div>
                <div>
                  <div>Active Entry: {currentEntry ? 'YES' : 'NO'}</div>
                  <div>Today Entries: {todayEntries.length}</div>
                  <div>Worked Hours: {workedHours.toFixed(2)}h</div>
                </div>
              </div>
              {currentEntry && (
                <div className="pt-2 border-t">
                  <div>Entry ID: {currentEntry.id}</div>
                  <div>Clock In: {currentEntry.clock_in_time}</div>
                  <div>Employee Name: {currentEntry.employee_name}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Team Status Section */}
        <Card className="shadow-xl border-border/20 bg-gradient-to-br from-card to-card/90 rounded-3xl overflow-hidden animate-scale-in">
          <CardHeader className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-secondary/20 to-accent/20 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">👥 Team Activity</CardTitle>
                  {teamStatus.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {teamStatus.length} colleague{teamStatus.length !== 1 ? 's' : ''} working
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTeamStatus(!showTeamStatus)}
                className="h-9 px-3 hover:scale-105 transition-transform"
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
            <CardContent className="px-6 pb-6 animate-fade-in">
              {teamStatus.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coffee className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    🏠 You're the first one here today!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Team members will appear here when they clock in
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamStatus.map((member, index) => (
                    <div 
                      key={index} 
                      className="bg-gradient-to-r from-success/5 to-primary/5 rounded-2xl p-4 border border-success/10 hover:shadow-md transition-all duration-200 animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <ProfileAvatar employeeName={member.employee_name} size="md" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse"></div>
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{member.employee_name}</p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Started at {member.clock_in_time}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-semibold">
                            ⏱️ {formatDuration(member.duration_minutes)}
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

        {/* Enhanced Today's Activity */}
        <Card className="shadow-xl border-border/20 bg-gradient-to-br from-card to-card/90 rounded-3xl overflow-hidden animate-scale-in">
          <CardHeader className="px-6 py-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">📊 Today's Activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {todayEntries.length} session{todayEntries.length !== 1 ? 's' : ''} recorded
                </p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="px-6 pb-6">
            {todayEntries.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-primary opacity-50" />
                </div>
                <p className="text-muted-foreground mb-2">
                  🎯 Ready to start your productive day?
                </p>
                <p className="text-xs text-muted-foreground">
                  Your work sessions will be tracked here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayEntries.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-2xl p-4 border border-border/20 hover:shadow-md transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                            <LogIn className="h-4 w-4 text-success" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold">Clock In</span>
                            <p className="text-lg font-bold text-success">{entry.clock_in_time}</p>
                          </div>
                        </div>
                        
                        {entry.clock_out_time && (
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                              <LogOut className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold">Clock Out</span>
                              <p className="text-lg font-bold text-destructive">{entry.clock_out_time}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        {entry.total_hours !== null ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-primary/20 font-bold text-lg px-3 py-1">
                              {entry.total_hours.toFixed(1)}h
                            </Badge>
                            <p className="text-xs text-muted-foreground">Total worked</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 animate-pulse">
                            🔄 Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Daily Summary */}
                {todayEntries.length > 0 && (
                  <Separator className="my-4" />
                )}
                {todayEntries.some(entry => entry.total_hours !== null) && (
                  <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-4 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">📈 Daily Total</p>
                          <p className="text-xs text-muted-foreground">Your productivity today</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold text-lg px-4 py-2">
                          {todayEntries
                            .filter(entry => entry.total_hours !== null)
                            .reduce((total, entry) => total + (entry.total_hours || 0), 0)
                            .toFixed(1)}h
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClockInOutPage;
