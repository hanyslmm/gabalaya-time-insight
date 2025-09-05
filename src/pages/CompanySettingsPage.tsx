
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Settings, Clock, Shield } from 'lucide-react';
import { COMMON_TIMEZONES, clearTimezoneCache } from '@/utils/timezoneUtils';
import { useAuth } from '@/hooks/useAuth';

const CompanySettingsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  const [message, setMessage] = useState('');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [autoClockoutEnabled, setAutoClockoutEnabled] = useState(true);
  const [autoClockoutTime, setAutoClockoutTime] = useState('01:00');
  const [maxWorkHours, setMaxWorkHours] = useState(8);
  const [autoClockoutLocation, setAutoClockoutLocation] = useState('Auto Clock-Out');

  // Fetch current company settings
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['company-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      let query = supabase
        .from('company_settings')
        .select('motivational_message, timezone, auto_clockout_enabled, auto_clockout_time, max_work_hours, auto_clockout_location');
      
      if (activeOrganizationId) {
        query = query.eq('organization_id', activeOrganizationId);
      }
      
      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        // If no settings exist, return default
        return { 
          motivational_message: "Keep up the great work! Your dedication and effort make a real difference to our team.",
          timezone: "Africa/Cairo",
          auto_clockout_enabled: true,
          auto_clockout_time: "01:00:00",
          max_work_hours: 8,
          auto_clockout_location: "Auto Clock-Out"
        };
      }
      
      return data || { 
        motivational_message: "Keep up the great work! Your dedication and effort make a real difference to our team.",
        timezone: "Africa/Cairo",
        auto_clockout_enabled: true,
        auto_clockout_time: "01:00:00",
        max_work_hours: 8,
        auto_clockout_location: "Auto Clock-Out"
      };
    }
  });

  // Save company settings
  const saveMutation = useMutation({
    mutationFn: async (settings: {
      newMessage: string;
      newTimezone: string;
      autoClockoutEnabled: boolean;
      autoClockoutTime: string;
      maxWorkHours: number;
      autoClockoutLocation: string;
    }) => {
      const { data, error } = await supabase
        .from('company_settings')
        .upsert({ 
          organization_id: activeOrganizationId,
          motivational_message: settings.newMessage,
          timezone: settings.newTimezone,
          auto_clockout_enabled: settings.autoClockoutEnabled,
          auto_clockout_time: settings.autoClockoutTime + ':00', // Add seconds
          max_work_hours: settings.maxWorkHours,
          auto_clockout_location: settings.autoClockoutLocation
        }, {
          onConflict: 'organization_id'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Company settings have been updated successfully.",
      });
      // Clear timezone cache to force reload
      clearTimezoneCache();
      queryClient.invalidateQueries({ queryKey: ['company-settings', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['motivational-message'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    if (message.trim()) {
      saveMutation.mutate({ 
        newMessage: message.trim(),
        newTimezone: timezone,
        autoClockoutEnabled,
        autoClockoutTime,
        maxWorkHours,
        autoClockoutLocation
      });
    }
  };

  React.useEffect(() => {
    if (currentSettings?.motivational_message) {
      setMessage(currentSettings.motivational_message);
    }
    if (currentSettings?.timezone) {
      setTimezone(currentSettings.timezone);
    }
    if (currentSettings?.auto_clockout_enabled !== undefined) {
      setAutoClockoutEnabled(currentSettings.auto_clockout_enabled);
    }
    if (currentSettings?.auto_clockout_time) {
      // Convert time format from "HH:MM:SS" to "HH:MM"
      setAutoClockoutTime(currentSettings.auto_clockout_time.substring(0, 5));
    }
    if (currentSettings?.max_work_hours !== undefined) {
      setMaxWorkHours(currentSettings.max_work_hours);
    }
    if (currentSettings?.auto_clockout_location) {
      setAutoClockoutLocation(currentSettings.auto_clockout_location);
    }
  }, [currentSettings]);

  if (isLoading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Company Settings</h1>
          <p className="mt-2 text-muted-foreground">Manage company-wide settings and messages</p>
        </div>
        
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-32 bg-muted/20 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Company Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage company-wide settings and messages</p>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              Employee Motivational Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="motivational-message">
                Message to Display on Employee Timesheet Page
              </Label>
              <Textarea
                id="motivational-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter a motivational message for your employees..."
                className="min-h-[120px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/500 characters
              </p>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium text-sm text-foreground mb-2">Preview:</h4>
              <p className="text-muted-foreground italic">
                "{message || 'Your motivational message will appear here...'}"
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !message.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Message'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-br from-card via-card to-secondary/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Clock className="h-5 w-5 text-secondary" />
              </div>
              Timezone Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="timezone-select">
                Company Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This timezone will be used for all employee clock-in/out times and reports.
              </p>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium text-sm text-foreground mb-2">Current Time Preview:</h4>
              <p className="text-muted-foreground">
                🕐 {new Date().toLocaleString('en-GB', { 
                  timeZone: timezone,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Times will be displayed in this timezone throughout the application
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Important:</strong> Changing the timezone will affect how all future times are displayed. 
                Existing timesheet entries will be converted to show in the new timezone.
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !message.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              Auto Clock-Out Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-clockout-enabled">
                  Enable Auto Clock-Out
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically clock out employees who forget or exceed work limits
                </p>
              </div>
              <Switch
                id="auto-clockout-enabled"
                checked={autoClockoutEnabled}
                onCheckedChange={setAutoClockoutEnabled}
              />
            </div>

            {autoClockoutEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-work-hours">
                      Maximum Work Hours
                    </Label>
                    <Input
                      id="max-work-hours"
                      type="number"
                      min="1"
                      max="24"
                      step="0.5"
                      value={maxWorkHours}
                      onChange={(e) => setMaxWorkHours(parseFloat(e.target.value) || 8)}
                      placeholder="8"
                    />
                    <p className="text-xs text-muted-foreground">
                      Employees will be auto clocked out after working this many hours
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auto-clockout-time">
                      Daily Auto Clock-Out Time
                    </Label>
                    <Input
                      id="auto-clockout-time"
                      type="time"
                      value={autoClockoutTime}
                      onChange={(e) => setAutoClockoutTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Employees still clocked in will be auto clocked out at this time the next day
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-clockout-location">
                    Auto Clock-Out Location
                  </Label>
                  <Input
                    id="auto-clockout-location"
                    type="text"
                    value={autoClockoutLocation}
                    onChange={(e) => setAutoClockoutLocation(e.target.value)}
                    placeholder="Auto Clock-Out"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    This location will be recorded for automatic clock-outs
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">
                    📋 Auto Clock-Out Rules:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Employees are clocked out after working {maxWorkHours} hours</li>
                    <li>• Employees are clocked out at {autoClockoutTime} the day after they clocked in</li>
                    <li>• Only admins can manually add extra hours after auto clock-out</li>
                    <li>• Auto clock-out runs automatically and cannot be disabled by employees</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !message.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
