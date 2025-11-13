
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WageSettings from '@/components/WageSettings';
import RoleManagement from '@/components/RoleManagement';
import PayPeriodSettings from '@/components/PayPeriodSettings';
import { useToast } from '@/hooks/use-toast';
import { COMMON_TIMEZONES, clearTimezoneCache } from '@/utils/timezoneUtils';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Save, Clock, Shield, Timer, Settings as SettingsIcon, Building2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  // Company settings state
  const [message, setMessage] = useState('');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [autoClockoutEnabled, setAutoClockoutEnabled] = useState(true);
  const [autoClockoutTime, setAutoClockoutTime] = useState('01:00');
  const [maxWorkHours, setMaxWorkHours] = useState(8);
  const [autoClockoutLocation, setAutoClockoutLocation] = useState('Auto Clock-Out');
  const [workingHoursWindowEnabled, setWorkingHoursWindowEnabled] = useState(true);
  const [workingHoursStartTime, setWorkingHoursStartTime] = useState('08:00');
  const [workingHoursEndTime, setWorkingHoursEndTime] = useState('01:00');

  // Fetch company settings
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
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
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
      const { data, error } = await supabase
        .from('company_settings')
        .upsert({
          organization_id: activeOrganizationId,
          motivational_message: settings.newMessage,
          timezone: settings.newTimezone,
          auto_clockout_enabled: settings.autoClockoutEnabled,
          auto_clockout_time: settings.autoClockoutTime + ':00',
          max_work_hours: settings.maxWorkHours,
          auto_clockout_location: settings.autoClockoutLocation,
          working_hours_window_enabled: settings.workingHoursWindowEnabled,
          working_hours_start_time: settings.workingHoursStartTime + ':00',
          working_hours_end_time: settings.workingHoursEndTime + ':00'
        }, { onConflict: 'organization_id' });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Settings saved', description: 'Company settings updated successfully.' });
      clearTimezoneCache();
      queryClient.invalidateQueries({ queryKey: ['company-settings', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['working-hours-settings', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['motivational-message'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    }
  });

  // Sync local state when data loads
  useEffect(() => {
    if (currentSettings && !(currentSettings as any)?.error) {
      const s: any = currentSettings;
      setMessage(s.motivational_message || 'Keep up the great work!');
      setTimezone(s.timezone || 'Africa/Cairo');
      setAutoClockoutEnabled(s.auto_clockout_enabled ?? true);
      setAutoClockoutTime((s.auto_clockout_time || '01:00:00').substring(0, 5));
      setMaxWorkHours(s.max_work_hours || 8);
      setAutoClockoutLocation(s.auto_clockout_location || 'Auto Clock-Out');
      setWorkingHoursWindowEnabled(s.working_hours_window_enabled ?? false);
      setWorkingHoursStartTime((s.working_hours_start_time || '08:00:00').substring(0, 5));
      setWorkingHoursEndTime((s.working_hours_end_time || '01:00:00').substring(0, 5));
    }
  }, [currentSettings]);

  const handleSaveCompany = () => {
    const msg = message.trim() || "Keep up the great work! Your dedication and effort make a real difference to our team.";
    saveMutation.mutate({
      newMessage: msg,
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

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('settings')}</h1>
          <p className="text-sm text-muted-foreground">Configure organization, payroll, roles, and system preferences</p>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="h-4 w-4 mr-1" /> Company</TabsTrigger>
          <TabsTrigger value="payroll">Payroll & Policies</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Employee Motivational Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="motivational-message">Message for employee pages</Label>
                  <Textarea id="motivational-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} className="min-h-[120px]" />
                  <p className="text-xs text-muted-foreground">{message.length}/500</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={saveMutation.isPending || !message.trim()}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card via-card to-secondary/5 border-border/50 shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  Timezone & Working Window
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Company Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timezone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Working Hours Window</Label>
                    <p className="text-xs text-muted-foreground">Limit payable hours to a window</p>
                  </div>
                  <Switch checked={workingHoursWindowEnabled} onCheckedChange={setWorkingHoursWindowEnabled} />
                </div>

                {workingHoursWindowEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={workingHoursStartTime} onChange={(e) => setWorkingHoursStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={workingHoursEndTime} onChange={(e) => setWorkingHoursEndTime(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Auto Clock-Out</Label>
                    <p className="text-xs text-muted-foreground">Auto close long-running sessions</p>
                  </div>
                  <Switch checked={autoClockoutEnabled} onCheckedChange={setAutoClockoutEnabled} />
                </div>

                {autoClockoutEnabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Max Work Hours</Label>
                        <Input type="number" min="1" max="24" step="0.5" value={maxWorkHours} onChange={(e) => setMaxWorkHours(parseFloat(e.target.value) || 8)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Daily Auto Clock-Out Time</Label>
                        <Input type="time" value={autoClockoutTime} onChange={(e) => setAutoClockoutTime(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Auto Clock-Out Location</Label>
                        <Input value={autoClockoutLocation} onChange={(e) => setAutoClockoutLocation(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save All'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payroll">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Wage Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <WageSettings />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pay Period Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <PayPeriodSettings />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <RoleManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Version</h4>
                  <p className="text-sm text-muted-foreground">2.8.1</p>
                </div>
                <div>
                  <h4 className="font-medium">Recent Updates</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>🔧 ProfilePage Fix: Fixed admin/owner profile loading with robust fallback mechanism and improved error handling</li>
                    <li>🎨 Theme Revamp Complete: All pages now use consistent theme variables for better dark mode support</li>
                    <li>📊 Employees Page Redesign: Converted card layout to modern table view with pagination for better data management</li>
                    <li>🔧 Unified Employee Operations: All employee actions (edit, wages, password, terminate, delete) now accessible from single edit dialog with tabs</li>
                    <li>📄 Enhanced Pagination: Added configurable items per page (10, 20, 50, 100) with smart page navigation</li>
                    <li>💰 Improved Wage Rate Input: Removed spinner controls from wage rate fields for direct number entry</li>
                    <li>🎨 UI/UX Revamp: Modernized color palette and design system for cleaner, more intuitive interface</li>
                    <li>✨ Enhanced Click Experience: Improved single-click responsiveness across desktop, eliminating double-click issues</li>
                    <li>✅ Better Checkbox Interaction: Increased checkbox size and clickable area for easier selection in timesheets</li>
                    <li>🚫 Disabled Annoying Animations: Removed scale/transform animations on hover and click for stable, professional feel</li>
                    <li>💚 Improved Amount Visibility: Enhanced totalAmount display with high-contrast green color in both light and dark themes</li>
                    <li>🔒 Dialog Stability: Fixed edit timesheet dialog positioning to prevent switching between modes</li>
                    <li>Unified Settings: merged Company + Settings into a modern tabbed page</li>
                    <li>Clock-In page: integrated Team Activity with admin actions (edit start, clock out, clock out all)</li>
                    <li>Reports: added role filter (supports custom roles like Housekeeping)</li>
                    <li>Date pickers: week now starts on Saturday in pay period filter</li>
                    <li>Roles: dynamic from database; manage in Settings → Roles & Permissions</li>
                    <li>Timesheets: database exclusion constraint to prevent overlapping entries</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
