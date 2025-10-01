
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface WageSettings {
  id: string;
  morning_start_time: string;
  morning_end_time: string;
  night_start_time: string;
  night_end_time: string;
  morning_wage_rate: number;
  night_wage_rate: number;
  default_flat_wage_rate: number;
}

const WageSettings: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  const [settings, setSettings] = useState<Partial<WageSettings>>({});

  const { data: wageSettings, isLoading } = useQuery({
    queryKey: ['wage-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      console.log('Fetching wage settings for organization:', activeOrganizationId);
      
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
              morning_start_time: '08:00:00',
              morning_end_time: '17:00:00',
              night_start_time: '17:00:00',
              night_end_time: '01:00:00',
              morning_wage_rate: 17.00,
              night_wage_rate: 20.00,
              default_flat_wage_rate: 20.00,
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
      return data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<WageSettings>) => {
      console.log('Updating wage settings:', {
        wageSettingsId: wageSettings?.id,
        activeOrganizationId,
        updatedSettings
      });
      
      if (!wageSettings?.id) {
        throw new Error('No wage settings ID found');
      }
      
      const updateQuery: any = (supabase as any)
        .from('wage_settings')
        .update({ ...updatedSettings, organization_id: activeOrganizationId })
        .eq('id', wageSettings.id)
        .eq('organization_id', activeOrganizationId)
        .select();
      
      const { data, error } = await updateQuery.single();
      
      if (error) {
        console.error('Error updating wage settings:', error);
        throw error;
      }
      
      console.log('Successfully updated wage settings:', data);
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
      setSettings(wageSettings);
    }
  }, [wageSettings]);

  const handleSave = () => {
    if (settings) {
      updateSettingsMutation.mutate(settings);
    }
  };

  const handleInputChange = (field: keyof WageSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
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
            value={settings.morning_start_time || '08:00'}
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
      
      <Button 
        onClick={handleSave} 
        disabled={updateSettingsMutation.isPending}
        className="w-full"
      >
        {updateSettingsMutation.isPending ? t('saving') || 'Saving...' : t('saveSettings') || 'Save Settings'}
      </Button>
    </div>
  );
};

export default WageSettings;
