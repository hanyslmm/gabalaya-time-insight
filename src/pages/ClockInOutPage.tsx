import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CheckCircle, AlertCircle, ExternalLink, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ClockEntry {
  id: string;
  clock_in_time: string;
  clock_in_date: string;
  clock_out_time?: string;
  clock_out_date?: string;
  clock_in_location?: string;
  clock_out_location?: string;
  total_hours?: number;
}

const LocationDisplay: React.FC<{ 
  location: string; 
  label: string; 
  className?: string; 
}> = ({ location, label, className = "" }) => {
  if (!location) return null;

  const [lat, lng] = location.split(', ').map(coord => parseFloat(coord.trim()));
  
  if (isNaN(lat) || isNaN(lng)) {
    // If coordinates are invalid, just show the raw location string
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}:</span>
        <span className="text-sm text-foreground">{location}</span>
      </div>
    );
  }

  // Google Maps URL for navigation
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const handleMapClick = () => {
    window.open(mapsUrl, '_blank');
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground font-mono">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </span>
      <button
        onClick={handleMapClick}
        className="p-1 rounded-md hover:bg-muted transition-colors"
        title="Open in Google Maps"
      >
        <ExternalLink className="h-4 w-4 text-blue-600 hover:text-blue-800" />
      </button>
    </div>
  );
};

const ClockInOutPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [location, setLocation] = useState<string>('');
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation is not supported by this browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve(`${latitude}, ${longitude}`);
        },
        (error) => {
          reject(`Unable to retrieve location: ${error.message}`);
        }
      );
    });
  };

  const capturePhoto = async (): Promise<string | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      return new Promise((resolve) => {
        video.addEventListener('loadedmetadata', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          
          stream.getTracks().forEach(track => track.stop());
          
          const photoDataURL = canvas.toDataURL('image/jpeg', 0.8);
          setCapturedPhoto(photoDataURL);
          resolve(photoDataURL);
        });
      });
    } catch (error) {
      console.warn('Camera access failed:', error);
      toast.error('Camera access denied. Continuing without photo.');
      return null;
    }
  };

  const fetchTodayEntries = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('employee_name', user.username) // Using username as employee identifier
      .eq('clock_in_date', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      return;
    }

    setTodayEntries(data || []);
    
    // Find active (not clocked out) entry - check for 00:00:00 or null clock_out_time
    const activeEntry = data?.find(entry => !entry.clock_out_time || entry.clock_out_time === '00:00:00');
    setCurrentEntry(activeEntry || null);
  };

  useEffect(() => {
    fetchTodayEntries();
  }, [user]);

  const handleClockIn = async () => {
    if (!user) {
      toast.error('Please log in to clock in');
      return;
    }

    setLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      setLocation(userLocation);
      
      // Attempt to capture photo (optional)
      await capturePhoto();
      
      const now = new Date();
      const { data, error } = await supabase
        .from('timesheet_entries')
        .insert({
          employee_name: user.username,
          employee_id: null, // Set to null since we don't have the actual employee table ID
          clock_in_date: format(now, 'yyyy-MM-dd'),
          clock_in_time: format(now, 'HH:mm:ss'),
          clock_out_date: format(now, 'yyyy-MM-dd'), // Required field but will be updated on clock out
          clock_out_time: '00:00:00', // Will be updated when employee clocks out
          total_hours: 0,
          total_card_amount_flat: 0,
          clock_in_location: userLocation
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentEntry(data);
      fetchTodayEntries();
      toast.success('Clocked in successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentEntry) {
      toast.error('No active clock-in session found');
      return;
    }

    setLoading(true);
    try {
      const userLocation = await getCurrentLocation();
      
      // Attempt to capture photo (optional)
      await capturePhoto();
      
      const now = new Date();
      const clockOutTime = format(now, 'HH:mm:ss');
      const clockOutDate = format(now, 'yyyy-MM-dd');

      // Calculate total hours
      const clockInDateTime = new Date(`${currentEntry.clock_in_date}T${currentEntry.clock_in_time}`);
      const clockOutDateTime = new Date(`${clockOutDate}T${clockOutTime}`);
      const totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('timesheet_entries')
        .update({
          clock_out_time: clockOutTime,
          clock_out_date: clockOutDate,
          clock_out_location: userLocation,
          total_hours: Math.max(0, totalHours)
        })
        .eq('id', currentEntry.id);

      if (error) throw error;

      setCurrentEntry(null);
      fetchTodayEntries();
      toast.success('Clocked out successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">Please log in to access the clock-in/out system.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Clock In/Out</h1>
        <p className="mt-2 text-sm text-gray-600">Track your work hours and location</p>
      </div>

      {/* Current Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Current Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg font-medium">Welcome, {user.full_name || user.username}</span>
                <Badge variant={currentEntry ? "default" : "secondary"}>
                  {currentEntry ? "Clocked In" : "Clocked Out"}
                </Badge>
              </div>
              {currentEntry && (
                <div className="text-sm text-gray-600">
                  <p>Clocked in at: {currentEntry.clock_in_time} on {currentEntry.clock_in_date}</p>
                  {currentEntry.clock_in_location && (
                    <LocationDisplay 
                      location={currentEntry.clock_in_location}
                      label="Clock In Location"
                      className="mt-2"
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              {!currentEntry ? (
                <Button 
                  onClick={handleClockIn} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {loading ? 'Clocking In...' : 'Clock In'}
                </Button>
              ) : (
                <Button 
                  onClick={handleClockOut} 
                  disabled={loading}
                  variant="destructive"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {loading ? 'Clocking Out...' : 'Clock Out'}
                </Button>
              )}
              
              {capturedPhoto && (
                <div className="flex items-center space-x-2 ml-4">
                  <Camera className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Photo captured</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No entries for today</p>
          ) : (
            <div className="space-y-4">
              {todayEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={entry.clock_out_time && entry.clock_out_time !== '00:00:00' ? "default" : "secondary"}>
                          {entry.clock_out_time && entry.clock_out_time !== '00:00:00' ? "Completed" : "Active"}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><strong>Clock In:</strong> {entry.clock_in_time} on {entry.clock_in_date}</p>
                        {entry.clock_out_time && entry.clock_out_time !== '00:00:00' && (
                          <p><strong>Clock Out:</strong> {entry.clock_out_time} on {entry.clock_out_date}</p>
                        )}
                        {entry.total_hours && (
                          <p><strong>Total Hours:</strong> {entry.total_hours.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {(entry.clock_in_location || entry.clock_out_location) && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {entry.clock_in_location && (
                        <LocationDisplay 
                          location={entry.clock_in_location}
                          label="Clock In"
                        />
                      )}
                      {entry.clock_out_location && (
                        <LocationDisplay 
                          location={entry.clock_out_location}
                          label="Clock Out"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClockInOutPage;