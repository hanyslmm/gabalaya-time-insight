
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';

interface WageSettings {
  id: string;
  morning_start_time: string;
  morning_end_time: string;
  night_start_time: string;
  night_end_time: string;
  morning_wage_rate: number;
  night_wage_rate: number;
  default_flat_wage_rate: number;
  working_hours_window_enabled: boolean;
  working_hours_start_time: string;
  working_hours_end_time: string;
}

const WageSettings: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  const [settings, setSettings] = useState<Partial<WageSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Normalize database time values (HH:mm:ss) to input-friendly HH:mm
  const toHHMM = (value?: string): string | undefined => {
    if (!value) return value;
    if (value.length === 5) return value;
    const parts = value.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return value;
  };

  // Keyboard shortcut: Cmd/Ctrl + S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const isSave = (isMac && e.metaKey && e.key.toLowerCase() === 's') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 's');
      if (isSave) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings]);

  const { data: wageSettings, isLoading } = useQuery({
    queryKey: ['wage-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      console.log('=== WAGE SETTINGS FETCH DEBUG ===');
      console.log('Fetching wage settings for organization:', activeOrganizationId);
      console.log('User context:', {
        userId: user?.id,
        username: user?.username,
        role: user?.role,
        organizationId: user?.organization_id,
        currentOrganizationId: user?.current_organization_id,
        isGlobalOwner: user?.is_global_owner
      });
      
      const query: any = (supabase as any)
        .from('wage_settings')
        .select('*')
        .eq('organization_id', activeOrganizationId);
      
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error('Error fetching wage settings:', error);
        throw error;
      }
      
      // If no organization-specific settings exist, try to create them from global defaults
      if (!data) {
        console.log('No wage settings found for organization, creating from defaults...');
        
        // First get global default settings
        const { data: globalSettings } = await supabase
          .from('wage_settings')
          .select('*')
          .is('organization_id', null)
          .single();
        
        if (globalSettings) {
          // Create organization-specific settings
          const { data: newSettings, error: createError } = await supabase
            .from('wage_settings')
            .insert({
              morning_start_time: globalSettings.morning_start_time,
              morning_end_time: globalSettings.morning_end_time,
              night_start_time: globalSettings.night_start_time,
              night_end_time: globalSettings.night_end_time,
              morning_wage_rate: globalSettings.morning_wage_rate,
              night_wage_rate: globalSettings.night_wage_rate,
              default_flat_wage_rate: globalSettings.default_flat_wage_rate,
              working_hours_window_enabled: globalSettings.working_hours_window_enabled ?? true,
              working_hours_start_time: globalSettings.working_hours_start_time ?? '08:00:00',
              working_hours_end_time: globalSettings.working_hours_end_time ?? '01:00:00',
              organization_id: activeOrganizationId
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating wage settings:', createError);
            throw createError;
          }
          
          console.log('Created new wage settings:', newSettings);
          return newSettings;
        } else {
          // Create with default values if no global settings exist
          const { data: defaultSettings, error: defaultError } = await supabase
            .from('wage_settings')
            .insert({
              morning_start_time: '06:00:00',
              morning_end_time: '17:00:00',
              night_start_time: '17:00:00',
              night_end_time: '06:00:00',
              morning_wage_rate: 17.00,
              night_wage_rate: 20.00,
              default_flat_wage_rate: 20.00,
              working_hours_window_enabled: true,
              working_hours_start_time: '08:00:00',
              working_hours_end_time: '01:00:00',
              organization_id: activeOrganizationId
            })
            .select()
            .single();
          
          if (defaultError) {
            console.error('Error creating default wage settings:', defaultError);
            throw defaultError;
          }
          
          console.log('Created default wage settings:', defaultSettings);
          return defaultSettings;
        }
      }
      
      console.log('Found existing wage settings:', data);
      console.log('=== END WAGE SETTINGS FETCH DEBUG ===');
      return data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<WageSettings>) => {
      console.log('=== WAGE SETTINGS UPDATE DEBUG ===');
      console.log('User info:', {
        userId: user?.id,
        username: user?.username,
        role: user?.role,
        organizationId: user?.organization_id,
        currentOrganizationId: user?.current_organization_id,
        isGlobalOwner: user?.is_global_owner
      });
      console.log('Active organization ID:', activeOrganizationId);
      console.log('Wage settings ID:', wageSettings?.id);
      console.log('Updated settings:', updatedSettings);
      
      if (!wageSettings?.id) {
        console.error('ERROR: No wage settings ID found');
        throw new Error('No wage settings ID found');
      }
      
      if (!activeOrganizationId) {
        console.error('ERROR: No active organization ID found');
        throw new Error('No active organization ID found');
      }
      
      // Convert time values back to HH:mm:ss format for database
      const dbSettings = { ...updatedSettings };
      if (dbSettings.morning_start_time && dbSettings.morning_start_time.length === 5) {
        dbSettings.morning_start_time = dbSettings.morning_start_time + ':00';
      }
      if (dbSettings.morning_end_time && dbSettings.morning_end_time.length === 5) {
        dbSettings.morning_end_time = dbSettings.morning_end_time + ':00';
      }
      if (dbSettings.night_start_time && dbSettings.night_start_time.length === 5) {
        dbSettings.night_start_time = dbSettings.night_start_time + ':00';
      }
      if (dbSettings.night_end_time && dbSettings.night_end_time.length === 5) {
        dbSettings.night_end_time = dbSettings.night_end_time + ':00';
      }
      if (dbSettings.working_hours_start_time && dbSettings.working_hours_start_time.length === 5) {
        dbSettings.working_hours_start_time = dbSettings.working_hours_start_time + ':00';
      }
      if (dbSettings.working_hours_end_time && dbSettings.working_hours_end_time.length === 5) {
        dbSettings.working_hours_end_time = dbSettings.working_hours_end_time + ':00';
      }
      
      console.log('Database settings (with time format):', dbSettings);
      
      // Attempt privileged update via edge function (recommended)
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('update-wage-settings', {
            body: {
              token,
              organizationId: activeOrganizationId,
              settings: dbSettings,
              createIfMissing: true
            }
          });
          console.log('Edge function update response:', { fnData, fnError });
          if (!fnError && (fnData as any)?.success) {
            console.log('Edge function update succeeded');
            return (fnData as any).data || null;
          }
        } else {
          console.warn('No auth_token found for edge function call; falling back to direct update');
        }
      } catch (fnErr) {
        console.error('Edge function update failed, will fallback to direct update', fnErr);
      }
      
      const updateQuery: any = (supabase as any)
        .from('wage_settings')
        .update({ ...dbSettings, organization_id: activeOrganizationId })
        .eq('id', wageSettings.id)
        .eq('organization_id', activeOrganizationId)
        .select();
      
      console.log('Executing direct update query...');
      
      // First, let's test if we can read the current wage settings
      console.log('Testing read access to wage_settings...');
      const { data: testRead, error: readError } = await supabase
        .from('wage_settings')
        .select('*')
        .eq('id', wageSettings.id)
        .eq('organization_id', activeOrganizationId);
      
      console.log('Read test result:', { testRead, readError });
      
      // Test RLS functions
      console.log('Testing RLS functions...');
      const { data: rlsTest, error: rlsError } = await supabase
        .rpc('is_admin');
      console.log('is_admin() result:', { rlsTest, rlsError });
      
      const { data: orgTest, error: orgError } = await supabase
        .rpc('current_user_organization_id');
      console.log('current_user_organization_id() result:', { orgTest, orgError });
      
      const { data, error } = await updateQuery.single();
      
      if (error) {
        console.error('ERROR updating wage settings:', {
          error,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          errorCode: error.code
        });
        throw error;
      }
      
      console.log('Successfully updated wage settings:', data);
      console.log('=== END WAGE SETTINGS UPDATE DEBUG ===');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wage-settings', activeOrganizationId] });
      toast.success(t('settingsUpdated') || 'Settings updated successfully');
    },
    onError: (error: any) => {
      console.error('Update mutation failed:', error);
      toast.error(t('errorUpdatingSettings') || `Error updating settings: ${error.message}`);
    }
  });

  useEffect(() => {
    if (wageSettings) {
      setSettings({
        ...wageSettings,
        morning_start_time: toHHMM(wageSettings.morning_start_time) as string,
        morning_end_time: toHHMM(wageSettings.morning_end_time) as string,
        night_start_time: toHHMM(wageSettings.night_start_time) as string,
        night_end_time: toHHMM(wageSettings.night_end_time) as string,
        working_hours_start_time: toHHMM(wageSettings.working_hours_start_time) as string,
        working_hours_end_time: toHHMM(wageSettings.working_hours_end_time) as string,
      });
      setHasChanges(false);
    }
  }, [wageSettings]);

  const handleSave = () => {
    if (settings) {
      updateSettingsMutation.mutate(settings);
    }
  };

  const handleInputChange = (field: keyof WageSettings, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label htmlFor="morning-start" className="text-sm font-medium text-gray-700">
            {t('morningStartTime') || 'Morning Start Time'}
          </Label>
          <Input
            id="morning-start"
            type="time"
            value={settings.morning_start_time || '06:00'}
            onChange={(e) => handleInputChange('morning_start_time', e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="morning-end" className="text-sm font-medium text-gray-700">
            {t('morningEndTime') || 'Morning End Time'}
          </Label>
          <Input
            id="morning-end"
            type="time"
            value={settings.morning_end_time || '17:00'}
            onChange={(e) => handleInputChange('morning_end_time', e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="night-start" className="text-sm font-medium text-gray-700">
            {t('nightStartTime') || 'Night Start Time'}
          </Label>
          <Input
            id="night-start"
            type="time"
            value={settings.night_start_time || '17:00'}
            onChange={(e) => handleInputChange('night_start_time', e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="night-end" className="text-sm font-medium text-gray-700">
            {t('nightEndTime') || 'Night End Time'}
          </Label>
          <Input
            id="night-end"
            type="time"
            value={settings.night_end_time || '01:00'}
            onChange={(e) => handleInputChange('night_end_time', e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="morning-rate" className="text-sm font-medium text-gray-700">
            {t('morningWageRate') || 'Morning Wage Rate (LE/hr)'}
          </Label>
          <Input
            id="morning-rate"
            type="number"
            step="0.01"
            value={settings.morning_wage_rate || 17.00}
            onChange={(e) => handleInputChange('morning_wage_rate', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="night-rate" className="text-sm font-medium text-gray-700">
            {t('nightWageRate') || 'Night Wage Rate (LE/hr)'}
          </Label>
          <Input
            id="night-rate"
            type="number"
            step="0.01"
            value={settings.night_wage_rate || 20.00}
            onChange={(e) => handleInputChange('night_wage_rate', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="space-y-3 md:col-span-2">
          <Label htmlFor="flat-rate" className="text-sm font-medium text-gray-700">
            {t('defaultFlatWageRate') || 'Default Flat Wage Rate (LE/hr)'}
          </Label>
          <Input
            id="flat-rate"
            type="number"
            step="0.01"
            value={settings.default_flat_wage_rate || 20.00}
            onChange={(e) => handleInputChange('default_flat_wage_rate', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Working Hours Window Configuration */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('workingHoursWindow') || 'Working Hours Window'}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('workingHoursWindowDescription') || 'Configure when employees can earn payable hours. Hours worked outside this window will not be counted for payroll.'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <Label htmlFor="working-hours-enabled" className="text-sm font-medium text-gray-700">
              {t('enableWorkingHoursWindow') || 'Enable Working Hours Window'}
            </Label>
            <div className="flex items-center space-x-3">
              <Switch
                id="working-hours-enabled"
                checked={Boolean(settings.working_hours_window_enabled)}
                onCheckedChange={(checked) => handleInputChange('working_hours_window_enabled', checked)}
              />
              <Label htmlFor="working-hours-enabled" className="text-sm text-gray-700">
                {settings.working_hours_window_enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
            <p className="text-xs text-gray-500">
              {t('workingHoursWindowHelp') || 'When enabled, only hours within the specified window are payable'}
            </p>
          </div>
          
          <>
            <div className="space-y-3">
              <Label htmlFor="working-hours-start" className="text-sm font-medium text-gray-700">
                {t('workingHoursStartTime') || 'Working Hours Start Time'}
              </Label>
              <Input
                id="working-hours-start"
                type="time"
                value={settings.working_hours_start_time || '08:00'}
                onChange={(e) => handleInputChange('working_hours_start_time', e.target.value)}
                className="w-full"
                disabled={!settings.working_hours_window_enabled}
              />
              <p className="text-xs text-gray-500">
                {t('workingHoursStartHelp') || 'Earliest time for payable hours (e.g., 08:00 for 8 AM)'}
              </p>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="working-hours-end" className="text-sm font-medium text-gray-700">
                {t('workingHoursEndTime') || 'Working Hours End Time'}
              </Label>
              <Input
                id="working-hours-end"
                type="time"
                value={settings.working_hours_end_time || '01:00'}
                onChange={(e) => handleInputChange('working_hours_end_time', e.target.value)}
                className="w-full"
                disabled={!settings.working_hours_window_enabled}
              />
              <p className="text-xs text-gray-500">
                {t('workingHoursEndHelp') || 'Latest time for payable hours (e.g., 01:00 for 1 AM next day)'}
              </p>
            </div>
          </>
        </div>
        
        {settings.working_hours_window_enabled && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              {t('workingHoursWindowRules') || 'Working Hours Window Rules:'}
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Only hours worked between {settings.working_hours_start_time || '08:00'} and {settings.working_hours_end_time || '01:00'} will be counted as payable hours</li>
              <li>• Hours worked outside this window will not be included in payroll calculations</li>
              <li>• This applies to both morning and night shift calculations</li>
              <li>• Employees can still clock in/out outside these hours, but those hours won't be paid</li>
            </ul>
          </div>
        )}
      </div>
      
      <div className="fixed bottom-4 right-4 z-10 flex items-center space-x-2">
        <Button 
          onClick={() => setSettings(wageSettings as any)}
          variant="secondary"
          disabled={!hasChanges || updateSettingsMutation.isPending}
        >
          {t('reset') || 'Reset'}
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? t('saving') || 'Saving...' : t('saveSettings') || 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default WageSettings;
