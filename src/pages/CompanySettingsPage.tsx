
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
import { MessageCircle, Save, Settings, Clock, Shield, Timer, Trophy, Coins, Sparkles } from 'lucide-react';
import { COMMON_TIMEZONES, clearTimezoneCache } from '@/utils/timezoneUtils';
import { useAuth } from '@/hooks/useAuth';
import PointsCatalogManagement from '@/components/PointsCatalogManagement';
import PointsLevelsManagement from '@/components/PointsLevelsManagement';

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
  const [workingHoursWindowEnabled, setWorkingHoursWindowEnabled] = useState(true);
  const [workingHoursStartTime, setWorkingHoursStartTime] = useState('08:00');
  const [workingHoursEndTime, setWorkingHoursEndTime] = useState('01:00');
  
  // Points System state
  const [isPointsSystemActive, setIsPointsSystemActive] = useState(false);
  const [pointValue, setPointValue] = useState(5);
  const [pointsBudget, setPointsBudget] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');

  // Fetch all company settings in one query
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['company-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const query = supabase
        .from('company_settings')
        .select(`
          motivational_message,
          timezone,
          auto_clockout_enabled,
          auto_clockout_time,
          max_work_hours,
          auto_clockout_location,
          working_hours_window_enabled,
          working_hours_start_time,
          working_hours_end_time
        `)
        .eq('organization_id', activeOrganizationId);
      
      const { data, error } = await query.single();

      // Handle case where no settings exist for the organization yet
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching company settings:', error);
        throw error;
      }

      // Return fetched data or a complete set of default values
      return data || {
        motivational_message: "Keep up the great work! Your dedication and effort make a real difference to our team.",
        timezone: "Africa/Cairo",
        auto_clockout_enabled: true,
        auto_clockout_time: "01:00:00",
        max_work_hours: 8,
        auto_clockout_location: "Auto Clock-Out",
        working_hours_window_enabled: false,
        working_hours_start_time: '08:00:00',
        working_hours_end_time: '01:00:00'
      };
    }
  });

  // Fetch organization data (including points system settings)
  const { data: organizationData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('is_points_system_active, points_budget, point_value')
        .eq('id', activeOrganizationId)
        .single();
      
      if (error) {
        // If columns don't exist yet, return defaults
        if (error.message?.includes('does not exist')) {
          return {
            is_points_system_active: false,
            points_budget: 0,
            point_value: 5.00
          };
        }
        throw error;
      }
      return (data as any) || {
        is_points_system_active: false,
        points_budget: 0,
        point_value: 5.00
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
      workingHoursWindowEnabled: boolean;
      workingHoursStartTime: string;
      workingHoursEndTime: string;
    }) => {
      // Save company settings including working hours window
      const { data, error } = await supabase
        .from('company_settings')
        .upsert({ 
          organization_id: activeOrganizationId,
          motivational_message: settings.newMessage,
          timezone: settings.newTimezone,
          auto_clockout_enabled: settings.autoClockoutEnabled,
          auto_clockout_time: settings.autoClockoutTime + ':00', // Add seconds
          max_work_hours: settings.maxWorkHours,
          auto_clockout_location: settings.autoClockoutLocation,
          working_hours_window_enabled: settings.workingHoursWindowEnabled,
          working_hours_start_time: settings.workingHoursStartTime + ':00',
          working_hours_end_time: settings.workingHoursEndTime + ':00'
        }, {
          onConflict: 'organization_id'
        });

      if (error) {
        console.error('Error saving company settings:', error);
        throw error;
      }


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
      queryClient.invalidateQueries({ queryKey: ['working-hours-settings', activeOrganizationId] });
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
    // Allow saving even without message if other settings are being changed
    const messageToSave = message.trim() || "Keep up the great work! Your dedication and effort make a real difference to our team.";
    
      saveMutation.mutate({ 
      newMessage: messageToSave,
        newTimezone: timezone,
        autoClockoutEnabled,
        autoClockoutTime,
        maxWorkHours,
      autoClockoutLocation,
      workingHoursWindowEnabled,
      workingHoursStartTime,
      workingHoursEndTime
      });
  };

  // Effect to update local state when settings are fetched
  React.useEffect(() => {
    if (currentSettings && !('error' in currentSettings)) {
      const settings = currentSettings as any;
      setMessage(settings.motivational_message || "Keep up the great work!");
      setTimezone(settings.timezone || 'Africa/Cairo');
      setAutoClockoutEnabled(settings.auto_clockout_enabled ?? true);
      setAutoClockoutTime((settings.auto_clockout_time || '01:00:00').substring(0, 5));
      setMaxWorkHours(settings.max_work_hours || 8);
      setAutoClockoutLocation(settings.auto_clockout_location || 'Auto Clock-Out');
      setWorkingHoursWindowEnabled(settings.working_hours_window_enabled ?? false);
      setWorkingHoursStartTime((settings.working_hours_start_time || '08:00:00').substring(0, 5));
      setWorkingHoursEndTime((settings.working_hours_end_time || '01:00:00').substring(0, 5));
    }
  }, [currentSettings]);

  // Effect to update points system state when organization data is fetched
  React.useEffect(() => {
    if (organizationData && !('error' in organizationData)) {
      const orgData = organizationData as any;
      setIsPointsSystemActive(orgData.is_points_system_active ?? false);
      setPointValue(Number(orgData.point_value) || 5);
      setPointsBudget(orgData.points_budget || 0);
    }
  }, [organizationData]);

  // Points System mutations
  const updatePointsSystemMutation = useMutation({
    mutationFn: async (updates: {
      is_points_system_active?: boolean;
      point_value?: number;
      points_budget?: number;
    }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates as any)
        .eq('id', activeOrganizationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', activeOrganizationId] });
      toast({
        title: "Points System Updated",
        description: "Points system settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update points system settings.",
        variant: "destructive",
      });
    }
  });

  const topUpBudgetMutation = useMutation({
    mutationFn: async (additionalPoints: number) => {
      const { data, error } = await supabase.rpc('top_up_points_budget' as any, {
        p_organization_id: activeOrganizationId,
        p_additional_points: additionalPoints
      });
      
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to top up budget');
      }
      return result;
    },
    onSuccess: (data: any) => {
      const amount = topUpAmount;
      setTopUpAmount('');
      queryClient.invalidateQueries({ queryKey: ['organization', activeOrganizationId] });
      toast({
        title: "Budget Topped Up",
        description: `Added ${amount} points. New budget: ${data.new_budget} points.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to top up budget.",
        variant: "destructive",
      });
    }
  });

  const seedCatalogMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('seed_points_catalog' as any, {
        p_organization_id: activeOrganizationId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-catalog', activeOrganizationId] });
      toast({
        title: "Catalog Seeded",
        description: "Default points catalog has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to seed catalog.",
        variant: "destructive",
      });
    }
  });

  const handlePointsSystemToggle = async (enabled: boolean) => {
    setIsPointsSystemActive(enabled);
    updatePointsSystemMutation.mutate({ is_points_system_active: enabled });
    
    // If enabling for the first time, seed the catalog
    if (enabled && organizationData && !('error' in organizationData)) {
      const orgData = organizationData as any;
      if (!orgData.is_points_system_active) {
        setTimeout(() => {
          seedCatalogMutation.mutate();
        }, 500);
      }
    }
  };

  const handleSavePointsConfig = () => {
    updatePointsSystemMutation.mutate({
      point_value: pointValue,
      points_budget: pointsBudget
    });
  };

  const handleTopUp = () => {
    const amount = parseInt(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }
    topUpBudgetMutation.mutate(amount);
  };

  if (isLoading || isLoadingOrg) {
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
                disabled={saveMutation.isPending}
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

                <div className="bg-muted/50 border border-border p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-foreground mb-2">
                    📋 Auto Clock-Out Rules:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
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
                disabled={saveMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              Working Hours Window
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="working-hours-enabled">
                  Enable Working Hours Window
                </Label>
                <p className="text-xs text-muted-foreground">
                  Limit payable hours to specific time periods (e.g., 8 AM to 1 AM)
                </p>
              </div>
              <Switch
                id="working-hours-enabled"
                checked={workingHoursWindowEnabled}
                onCheckedChange={setWorkingHoursWindowEnabled}
              />
            </div>

            {workingHoursWindowEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="working-hours-start">
                      Working Hours Start Time
                    </Label>
                    <Input
                      id="working-hours-start"
                      type="time"
                      value={workingHoursStartTime}
                      onChange={(e) => setWorkingHoursStartTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Earliest time for payable hours (e.g., 08:00 for 8 AM)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="working-hours-end">
                      Working Hours End Time
                    </Label>
                    <Input
                      id="working-hours-end"
                      type="time"
                      value={workingHoursEndTime}
                      onChange={(e) => setWorkingHoursEndTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Latest time for payable hours (e.g., 01:00 for 1 AM next day)
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 border border-border p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-foreground mb-2">
                    📋 Working Hours Window Rules:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Only hours worked between {workingHoursStartTime} and {workingHoursEndTime} will be counted as payable hours</li>
                    <li>• Hours worked outside this window will not be included in payroll calculations</li>
                    <li>• This applies to both morning and night shift calculations</li>
                    <li>• Employees can still clock in/out outside these hours, but those hours won't be paid</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Champions Points System Configuration */}
        <Card className="mt-6 bg-gradient-to-br from-card via-card to-yellow-500/5 border-yellow-500/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              Champions Points System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="points-system-enabled">
                  Enable Points System
                </Label>
                <p className="text-xs text-muted-foreground">
                  Activate gamified points system with monetary rewards for employees
                </p>
              </div>
              <Switch
                id="points-system-enabled"
                checked={isPointsSystemActive}
                onCheckedChange={handlePointsSystemToggle}
                disabled={updatePointsSystemMutation.isPending}
              />
            </div>

            {isPointsSystemActive && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="point-value">
                      Point Value (EGP)
                    </Label>
                    <Input
                      id="point-value"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={pointValue}
                      onChange={(e) => setPointValue(parseFloat(e.target.value) || 5)}
                      placeholder="5.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Monetary value of 1 point in EGP (default: 5 EGP)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="points-budget">
                      Initial Points Budget
                    </Label>
                    <Input
                      id="points-budget"
                      type="number"
                      min="0"
                      step="1"
                      value={pointsBudget}
                      onChange={(e) => setPointsBudget(parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Monthly points budget (managers spend from this)
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 border border-border p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-sm text-foreground mb-1">
                        Current Budget Status
                      </h4>
                      <p className="text-2xl font-bold text-primary">
                        {pointsBudget} <span className="text-sm font-normal text-muted-foreground">points</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ≈ {pointsBudget * pointValue} EGP available
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-24"
                      />
                      <Button
                        onClick={handleTopUp}
                        disabled={topUpBudgetMutation.isPending || !topUpAmount}
                        size="sm"
                        variant="outline"
                      >
                        <Coins className="h-4 w-4 mr-1" />
                        Top Up
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    Points System Rules:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 1 Point = {pointValue} EGP (configurable)</li>
                    <li>• Managers cannot award positive points if budget is empty</li>
                    <li>• Deducting points (penalties) does NOT refund the budget</li>
                    <li>• Points are tracked per employee with full transaction history</li>
                    <li>• Employees can see their total points and potential bonus</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    onClick={handleSavePointsConfig}
                    disabled={updatePointsSystemMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updatePointsSystemMutation.isPending ? 'Saving...' : 'Save Points Configuration'}
                  </Button>
                </div>

                {/* Points Catalog Management */}
                <div className="mt-6 pt-6 border-t">
                  <PointsCatalogManagement />
                </div>

                {/* Points Levels Management */}
                <div className="mt-6 pt-6 border-t">
                  <PointsLevelsManagement />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
