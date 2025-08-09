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
import { getCurrentCompanyTime, getTodayInCompanyTimezone, validateTimezone, parseCompanyDateTime } from '@/utils/timezoneUtils';
import { getTimezoneAbbreviation, formatTimeToAMPM } from '@/utils/timeFormatter';

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
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [companyTimezone, setCompanyTimezone] = useState<string>('Africa/Cairo');

  // Simplified loading timeout - just one timeout to prevent infinite loading
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached, forcing component to load');
        setLoading(false);
        setInitializationError('Loading took longer than expected. Some features may not work correctly.');
      }
    }, 8000); // 8 second timeout

    return () => clearTimeout(loadingTimeout);
  }, [loading]);

  // Fetch motivational message and timezone info on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch motivational message
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('motivational_message')
          .single();
        
        if (settingsData?.motivational_message) {
          setMotivationalMessage(settingsData.motivational_message);
        }
      } catch (error) {
        console.warn('Could not fetch motivational message:', error);
      }
      
      try {
        // Validate timezone
        const validation = await validateTimezone();
        setCompanyTimezone(validation.timezone);
        
        if (!validation.isValid) {
          console.warn(`Timezone issue: ${validation.message}`);
          setInitializationError(`Timezone issue: ${validation.message}`);
        }
        
        const abbr = await getTimezoneAbbreviation();
        setTimezoneAbbr(abbr);
      } catch (error) {
        console.warn('Could not fetch timezone info:', error);
        setTimezoneAbbr('UTC+2'); // Fallback
      }
    };
    
    fetchInitialData();
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

  // Helper to format DB times in company's timezone (AM/PM)
  const formatCompanyTimeAMPM = useCallback((dateStr: string, timeStr: string) => {
    try {
      const baseTime = (timeStr || '').split('.')[0];
      if (!dateStr || !baseTime) return '';
      // Treat DB time as UTC and format in company timezone
      const utcDate = new Date(`${dateStr}T${baseTime}Z`);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: companyTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return formatter.format(utcDate);
    } catch {
      return formatTimeToAMPM((timeStr || '').split('.')[0]);
    }
  }, [companyTimezone]);

  // Fetch team status (other employees' clock-in status)
  const fetchTeamStatus = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all employees to map IDs to names
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('staff_id, full_name, role');

      if (employeesError) {
        console.warn('Could not fetch employees for team status:', employeesError);
        return;
      }

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

      if (timesheetError) {
        console.warn('Could not fetch team timesheet data:', timesheetError);
        return;
      }

      // Process team member statuses
      const statusMap = new Map<string, TeamMemberStatus>();
      const nowUtc = new Date();

      for (const entry of timesheetData || []) {
        // Improved logic: Check for active entry (null, undefined, or empty string)
        const isActive = entry.clock_out_time === null ||
                         entry.clock_out_time === undefined ||
                         entry.clock_out_time === '';

        // Parse clock-in in company timezone then convert to UTC for reliable diff
        const baseTime = String(entry.clock_in_time || '').split('.')[0];
        const clockInDateTimeStr = `${entry.clock_in_date} ${baseTime}`;
        const clockInUtc = await parseCompanyDateTime(clockInDateTimeStr);

        const duration = isActive
          ? differenceInMinutes(nowUtc, clockInUtc)
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
        if (displayName === user?.full_name || entry.employee_name === user?.username) {
          continue;
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
      }

      // Only show active team members
      const activeTeamMembers = Array.from(statusMap.values()).filter(status => status.is_active);
      setTeamStatus(activeTeamMembers);
    } catch (error) {
      console.warn('Error fetching team status:', error);
    }
  }, [user]);

  // Fetch today's clock-in/out entries
  const fetchTodayEntries = useCallback(async () => {
    console.log('fetchTodayEntries: Starting, user:', user?.username);
    
    if (!user) {
      console.log('fetchTodayEntries: No user, setting loading to false');
      setLoading(false);
      return;
    }
    
    try {
      console.log('fetchTodayEntries: Getting today in company timezone...');
      const today = await getTodayInCompanyTimezone();
      console.log('fetchTodayEntries: Today is:', today);
      
      // First, get the employee record to find the correct employee_id
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id, staff_id, full_name')
        .or(`staff_id.eq.${user.username},full_name.eq.${user.full_name}`)
        .limit(1);

      // Build user identifiers for timesheet lookup (both by name and by employee_id)
      const userIdentifiers = [
        user.username,
        user.full_name
      ];

      // Filter out null/undefined values
      const validIdentifiers = userIdentifiers.filter(id => id && id.trim() !== '');
      

      // Build OR query for all possible identifiers (including employee_id)
      let orQuery = validIdentifiers.map(id => `employee_name.eq.${id}`).join(',');
      
      // Add employee_id to the search if we found the employee record
      if (employeeData && employeeData.length > 0) {
        const employeeId = employeeData[0].id;
        orQuery += `,employee_id.eq.${employeeId}`;
      }
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .or(orQuery)
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (error) {
        console.warn("Could not fetch today's entries:", error);
        setInitializationError("Could not fetch today's entries. Please refresh the page.");
        return;
      }

      console.log('fetchTodayEntries: Found', data?.length || 0, 'entries');
      setTodayEntries(data || []);
      
      // Find the most recent entry without clock_out_time (active entry)
      // Improved logic: entry without clock_out_time (null, undefined, or empty string)
      const activeEntry = data?.find(entry => 
        entry.clock_out_time === null || 
        entry.clock_out_time === undefined ||
        entry.clock_out_time === ''
      ) || null;
      console.log('fetchTodayEntries: Active entry:', activeEntry?.id || 'none');
      setCurrentEntry(activeEntry);
      
    } catch (error) {
      console.error("fetchTodayEntries: Error fetching today's entries:", error);
      setInitializationError("Error loading your timesheet data. Please refresh the page.");
    } finally {
      console.log('fetchTodayEntries: Setting loading to false');
      setLoading(false);
    }
  }, [user]);

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
          // Parse the clock-in time as company timezone and convert to UTC for proper comparison
          const clockInDateTimeStr = `${currentEntry.clock_in_date} ${currentEntry.clock_in_time.split('.')[0]}`;
          const clockInDateTime = await parseCompanyDateTime(clockInDateTimeStr);
          const minutesWorked = differenceInMinutes(utcNow, clockInDateTime);
          setWorkedHours(minutesWorked / 60);
        }
      } catch (error) {
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

  // Main initialization effect - simplified
  useEffect(() => {
    console.log('ClockInOutPage: useEffect triggered, user:', user?.username);
    
    if (!user) {
      console.log('ClockInOutPage: No user found, setting loading to false');
      setLoading(false);
      return;
    }

    const initializeData = async () => {
      try {
        console.log('ClockInOutPage: Initializing data for user:', user.username);
        
        // Test database connection first
        const { data: testData, error: testError } = await supabase.from('company_settings').select('id').limit(1);
        if (testError) {
          console.warn('ClockInOutPage: Database connection issue:', testError);
          setInitializationError('Database connection issue. Please refresh the page.');
        } else {
          console.log('ClockInOutPage: Database connection successful');
        }
        
        // Fetch today's entries (this will set loading to false)
        console.log('ClockInOutPage: Fetching today\'s entries...');
        await fetchTodayEntries();
        
        // Fetch team status (non-blocking)
        console.log('ClockInOutPage: Fetching team status...');
        fetchTeamStatus().catch(error => {
          console.warn('ClockInOutPage: Could not fetch team status:', error);
        });
        
      } catch (error) {
        console.error('ClockInOutPage: Error initializing data:', error);
        setInitializationError('Failed to initialize page data. Please refresh.');
        setLoading(false);
      }
    };

    initializeData();
    
    // Set up interval to refresh team status every 30 seconds
    const interval = setInterval(() => {
      fetchTeamStatus().catch(error => {
        console.warn('ClockInOutPage: Could not refresh team status:', error);
      });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user, fetchTodayEntries, fetchTeamStatus]);

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


      const { data, error } = await supabase.rpc('clock_in', {
        p_staff_id: staffId,
        p_clock_in_location: userLocation,
      });

      if (error) {
        // If the error is about already being clocked in, handle the sync issue
        if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('clocked in')) {
          toast.info('⚠️ Sync issue detected. Fixing your clock-in status...');
          
          try {
            // Call the fix function to force clock out any orphaned entries
            const { data: fixData, error: fixError } = await supabase.functions.invoke('fix-clock-in-issues', {
              body: { action: 'force_clock_out', staff_id: staffId }
            });

            if (fixError || !fixData?.success) {
              toast.error('❌ Unable to fix sync issue. Please contact your administrator.');
              return;
            }

            // Show success message about the fix
            if (fixData.entries_closed > 0) {
              toast.success(`✅ Fixed ${fixData.entries_closed} orphaned entry(ies). You can now clock in.`);
            } else {
              toast.info('✅ Status synchronized. You can now clock in.');
            }

            // Now try to clock in again
            const { data: retryData, error: retryError } = await supabase.rpc('clock_in', {
              p_staff_id: staffId,
              p_clock_in_location: userLocation,
            });

            if (retryError) {
              toast.error(`❌ ${retryError.message}`);
              return;
            }

            // Success - refresh the data
            await fetchTodayEntries();
            await fetchTeamStatus();
            toast.success('🎉 Clocked in successfully!');
            return;

          } catch (fixError) {
            console.error('Error fixing sync issue:', fixError);
            toast.error('❌ Unable to fix sync issue. Please contact your administrator.');
            return;
          }
        }
        throw new Error(error.message);
      }
      
      await fetchTodayEntries();
      await fetchTeamStatus(); // Refresh team status after clock in
      toast.success('Clocked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
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
        <p className="text-xs text-muted-foreground">Please wait while we load your data...</p>
        {initializationError && (
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{initializationError}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }


  return (
    <div className="w-full px-1 sm:px-2 lg:px-4 pb-safe min-h-screen">
      <div className="max-w-md mx-auto space-y-3 sm:space-y-4">
        {/* Greeting Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10">
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
                    Debug: UTC {new Date().toISOString()} | Local {new Date().toLocaleString()} | Company {companyTime.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-2xl">
                {currentEntry ? '🎯' : '☀️'}
              </div>
            </div>
          </CardContent>
        </Card>

        {initializationError && (
          <Alert variant="destructive" className="rounded-2xl animate-slide-in-right">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-foreground font-medium">
              {initializationError}
            </AlertDescription>
          </Alert>
        )}

        {motivationalMessage && !initializationError && (
          <Alert variant="default" className="bg-gradient-to-r from-accent/10 to-secondary/10 border-accent/20 rounded-2xl animate-slide-in-right">
            <Zap className="h-4 w-4 text-accent" />
            <AlertDescription className="text-foreground font-medium">
              {motivationalMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Clock In/Out Card */}
        <Card className="shadow-2xl border-border/20 bg-gradient-to-br from-card via-card/95 to-card/90 rounded-3xl overflow-hidden">
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
                      <span>Since {formatCompanyTimeAMPM(currentEntry.clock_in_date, currentEntry.clock_in_time)}</span>
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
                  <div>Timezone: {timezoneAbbr}</div>
                </div>
                <div>
                  <div>Active Entry: {currentEntry ? 'YES' : 'NO'}</div>
                  <div>Today Entries: {todayEntries.length}</div>
                  <div>Worked Hours: {workedHours.toFixed(2)}h</div>
                  <div>Target Hours: {targetHours}h</div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div>Current Time (UTC): {currentTime.toISOString()}</div>
                <div>Company Time: {companyTime.toLocaleString()}</div>
                <div>Company Time (ISO): {companyTime.toISOString()}</div>
              </div>
              {currentEntry && (
                <div className="pt-2 border-t">
                  <div>Entry ID: {currentEntry.id}</div>
                                      <div>Clock In: {currentEntry.clock_in_date} {formatCompanyTimeAMPM(currentEntry.clock_in_date, currentEntry.clock_in_time)}</div>
                  <div>Employee Name: {currentEntry.employee_name}</div>
                  <div>Clock In Location: {currentEntry.clock_in_location || 'N/A'}</div>
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
                              <span>Started at {formatCompanyTimeAMPM(member.clock_in_date, member.clock_in_time)}</span>
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
                            <p className="text-lg font-bold text-success">{formatCompanyTimeAMPM(entry.clock_in_date, entry.clock_in_time)}</p>
                          </div>
                        </div>
                        
                        {entry.clock_out_time && (
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                              <LogOut className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold">Clock Out</span>
                              <p className="text-lg font-bold text-destructive">{formatCompanyTimeAMPM(entry.clock_out_date || entry.clock_in_date, entry.clock_out_time)}</p>
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
