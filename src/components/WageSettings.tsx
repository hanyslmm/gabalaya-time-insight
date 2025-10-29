
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
      
      // If no organization-specific settings exist, return default values for display
      // The edge function will create them on first save
      if (!data) {
        console.log('No wage settings found for organization, will create on save');
        
        // Return default values for the form
        return {
          id: null, // Will be created on save
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
        };
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
      
      if (!activeOrganizationId) {
        console.error('ERROR: No active organization ID found');
        throw new Error('No active organization ID found');
      }
      
      // Note: wageSettings?.id might be null if creating for the first time
      // The edge function will handle creation with createIfMissing: true
      console.log('Will create settings if missing:', !wageSettings?.id);
      
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
        console.log('Auth token exists?', !!token);
        console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'NO TOKEN');
        
        // Decode and log token payload for debugging
        if (token) {
          try {
            const tokenPayload = JSON.parse(atob(token));
            console.log('Token payload:', {
              role: tokenPayload.role,
              organization_id: tokenPayload.organization_id,
              current_organization_id: tokenPayload.current_organization_id,
              is_global_owner: tokenPayload.is_global_owner,
              exp: tokenPayload.exp,
              isExpired: tokenPayload.exp && tokenPayload.exp < Date.now()
            });
          } catch (e) {
            console.error('Failed to decode token:', e);
          }
        }
        
        if (token) {
          console.log('Invoking edge function with:', {
            organizationId: activeOrganizationId,
            settingsKeys: Object.keys(dbSettings),
            createIfMissing: true
          });
          
          const { data: fnData, error: fnError } = await supabase.functions.invoke('update-wage-settings', {
            body: {
              token,
              organizationId: activeOrganizationId,
              settings: dbSettings,
              createIfMissing: true
            }
          });
          console.log('Edge function update response:', { fnData, fnError });
          console.log('Response data details:', JSON.stringify(fnData, null, 2));
          console.log('Response error details:', JSON.stringify(fnError, null, 2));
          
          if (fnError) {
            console.error('Edge function returned error:', fnError);
            const errorDetail = (fnData as any)?.error || fnError.message || JSON.stringify(fnError);
            throw new Error(`Edge function error: ${errorDetail}`);
          }
          if ((fnData as any)?.success) {
            console.log('Edge function update succeeded');
            return (fnData as any).data || null;
          } else {
            console.error('Edge function returned failure:', fnData);
            throw new Error(`Edge function failed: ${(fnData as any)?.error || 'Unknown error'}`);
          }
        } else {
          console.error('No auth_token found in localStorage');
          throw new Error('No authentication token found. Please log in again.');
        }
      } catch (fnErr) {
        console.error('Edge function call exception:', fnErr);
        throw fnErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wage-settings', activeOrganizationId] });
      toast.success(t('settingsUpdated') || 'Settings updated successfully');
    },
    onError: (error: any) => {
      console.error('Update mutation failed:', error);
      const errorMsg = error.message || JSON.stringify(error);
      toast.error(`Error updating settings: ${errorMsg}`);
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
