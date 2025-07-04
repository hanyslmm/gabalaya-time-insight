
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInHours } from 'date-fns';

interface Notification {
  id: string;
  type: 'overtime' | 'long_shift' | 'missing_clockout' | 'late_arrival';
  title: string;
  message: string;
  employee_name: string;
  employee_id: string;
  timestamp: Date;
  read: boolean;
}

const NotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      checkForNotifications();
      // Check every 5 minutes
      const interval = setInterval(checkForNotifications, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkForNotifications = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch timesheet entries with employee information
      const { data: entries, error: entriesError } = await supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees (
            id,
            full_name,
            staff_id
          )
        `)
        .eq('clock_in_date', today);

      if (entriesError) throw entriesError;

      const newNotifications: Notification[] = [];

      entries?.forEach(entry => {
        const clockInTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
        const now = new Date();
        const employeeName = entry.employees?.full_name || entry.employee_name;
        const employeeId = entry.employees?.staff_id || entry.employee_id;

        // Check for long shifts (over 10 hours without clocking out)
        if ((!entry.clock_out_time || entry.clock_out_time === '00:00:00') && 
            differenceInHours(now, clockInTime) > 10) {
          newNotifications.push({
            id: `long_shift_${entry.id}`,
            type: 'long_shift',
            title: 'Long Shift Alert',
            message: `${employeeName} has been working for over 10 hours`,
            employee_name: employeeName,
            employee_id: employeeId,
            timestamp: now,
            read: false
          });
        }

        // Check for missing clock-out (over 12 hours)
        if ((!entry.clock_out_time || entry.clock_out_time === '00:00:00') && 
            differenceInHours(now, clockInTime) > 12) {
          newNotifications.push({
            id: `missing_clockout_${entry.id}`,
            type: 'missing_clockout',
            title: 'Missing Clock-Out',
            message: `${employeeName} may have forgotten to clock out`,
            employee_name: employeeName,
            employee_id: employeeId,
            timestamp: now,
            read: false
          });
        }

        // Check for overtime (over 8 hours completed)
        if (entry.total_hours && entry.total_hours > 8) {
          newNotifications.push({
            id: `overtime_${entry.id}`,
            type: 'overtime',
            title: 'Overtime Detected',
            message: `${employeeName} worked ${entry.total_hours.toFixed(1)} hours`,
            employee_name: employeeName,
            employee_id: employeeId,
            timestamp: now,
            read: false
          });
        }
      });

      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
        return [...prev, ...uniqueNew].slice(-20); // Keep last 20 notifications
      });

    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'overtime':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'long_shift':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'missing_clockout':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'late_arrival':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'overtime':
        return 'border-l-orange-500';
      case 'long_shift':
        return 'border-l-red-500';
      case 'missing_clockout':
        return 'border-l-red-500';
      case 'late_arrival':
        return 'border-l-yellow-500';
      default:
        return 'border-l-blue-500';
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-red-500 hover:bg-red-600">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {showNotifications && (
        <Card className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No notifications
              </p>
            ) : (
              <div className="space-y-2 p-4">
                {notifications.slice().reverse().map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-l-4 ${getNotificationColor(notification.type)} ${
                      notification.read ? 'bg-muted/50' : 'bg-background'
                    } rounded-r-lg cursor-pointer hover:bg-muted/30 transition-colors`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(notification.timestamp, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(notification.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSystem;
