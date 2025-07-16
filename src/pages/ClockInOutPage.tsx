import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, LogIn, LogOut, MapPin, AlertCircle } from 'lucide-react';
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
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('employee_name', user.full_name)
      .eq('clock_in_date', today)
      .order('clock_in_time', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      toast.error("Could not fetch today's entries.");
    } else {
      setTodayEntries(data);
      const activeEntry = data.find(entry => !entry.clock_out_time);
      setCurrentEntry(activeEntry || null);
    }
    setLoading(false);
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

    setActionLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);

      const { data, error } = await supabase.rpc('clock_in', {
        p_staff_id: user.username,
        p_clock_in_location: userLocation,
      });

      if (error) throw new Error(error.message);
      
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
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {motivationalMessage && (
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {motivationalMessage}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg border-border/30">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold">
              {currentEntry ? 'You are Clocked In' : 'Ready to Work?'}
            </CardTitle>
            <CardDescription>
              {format(new Date(), 'eeee, MMMM dd, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentEntry ? (
              <div className="text-center space-y-4">
                <p className="text-lg">
                  Clocked in at <span className="font-semibold text-primary">{currentEntry.clock_in_time}</span>
                </p>
                {currentEntry.clock_in_location && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{currentEntry.clock_in_location}</span>
                  </div>
                )}
                <Button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="w-full bg-destructive hover:bg-destructive/90"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {actionLoading ? 'Clocking Out...' : 'Clock Out'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {actionLoading ? 'Clocking In...' : 'Clock In'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8 shadow-lg border-border/30">
          <CardHeader>
            <CardTitle>Today's Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {todayEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No entries for today yet
              </p>
            ) : (
              <ul className="space-y-3">
                {todayEntries.map((entry) => (
                  <li key={entry.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm">
                      <p>
                        <span className="font-semibold">In:</span> {entry.clock_in_time}
                      </p>
                      {entry.clock_out_time && (
                        <p>
                          <span className="font-semibold">Out:</span> {entry.clock_out_time}
                        </p>
                      )}
                    </div>
                    {entry.total_hours !== null && (
                      <Badge variant="secondary">
                        {entry.total_hours.toFixed(2)} hours
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClockInOutPage;
