import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

const ClockInOutPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true); // For initial page load
  const [actionLoading, setActionLoading] = useState(false); // For button clicks
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
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

  // Fetch today's clock-in/out entries
  const fetchTodayEntries = async () => {
    if (!user || !user.full_name) {
      setLoading(false);
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('employee_name', user.full_name)
        .eq('clock_in_date', today)
        .order('clock_in_time', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error);
        toast.error("Could not fetch today's entries.");
        return;
      }

      setTodayEntries(data || []);
      
      // Find the most recent entry without clock_out_time (active entry)
      const activeEntry = data?.find(entry => !entry.clock_out_time) || null;
      setCurrentEntry(activeEntry);
      
      // Debug logging
      console.log('Today entries:', data);
      console.log('Active entry:', activeEntry);
      
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

      const { data, error } = await supabase.rpc('clock_in', {
        p_staff_id: user.username,
        p_clock_in_location: userLocation,
      });

      if (error) {
        // If the error is about already being clocked in, refresh the entries to show the current state
        if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('clocked in')) {
          await fetchTodayEntries();
          toast.info('You are already clocked in. The page has been refreshed to show your current status.');
          return;
        }
        throw new Error(error.message);
      }
      
      await fetchTodayEntries();
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
      toast.success('Clocked out successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
      console.error('Clock-out error:', error);
    } finally {
      setActionLoading(false);
    }
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
                onClick={fetchTodayEntries}
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
