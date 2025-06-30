
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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
  const [settings, setSettings] = useState<Partial<WageSettings>>({});

  const { data: wageSettings, isLoading } = useQuery({
    queryKey: ['wage-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wage_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<WageSettings>) => {
      const { data, error } = await supabase
        .from('wage_settings')
        .update(updatedSettings)
        .eq('id', wageSettings?.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wage-settings'] });
      toast.success(t('settingsUpdated') || 'Settings updated successfully');
    },
    onError: (error) => {
      console.error('Error updating wage settings:', error);
      toast.error(t('errorUpdatingSettings') || 'Error updating settings');
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="morning-start">{t('morningStartTime') || 'Morning Start Time'}</Label>
          <Input
            id="morning-start"
            type="time"
            value={settings.morning_start_time || '08:00'}
            onChange={(e) => handleInputChange('morning_start_time', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="morning-end">{t('morningEndTime') || 'Morning End Time'}</Label>
          <Input
            id="morning-end"
            type="time"
            value={settings.morning_end_time || '17:00'}
            onChange={(e) => handleInputChange('morning_end_time', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="night-start">{t('nightStartTime') || 'Night Start Time'}</Label>
          <Input
            id="night-start"
            type="time"
            value={settings.night_start_time || '17:00'}
            onChange={(e) => handleInputChange('night_start_time', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="night-end">{t('nightEndTime') || 'Night End Time'}</Label>
          <Input
            id="night-end"
            type="time"
            value={settings.night_end_time || '01:00'}
            onChange={(e) => handleInputChange('night_end_time', e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="morning-rate">{t('morningWageRate') || 'Morning Wage Rate (LE/hr)'}</Label>
          <Input
            id="morning-rate"
            type="number"
            step="0.01"
            value={settings.morning_wage_rate || 17.00}
            onChange={(e) => handleInputChange('morning_wage_rate', parseFloat(e.target.value))}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="night-rate">{t('nightWageRate') || 'Night Wage Rate (LE/hr)'}</Label>
          <Input
            id="night-rate"
            type="number"
            step="0.01"
            value={settings.night_wage_rate || 20.00}
            onChange={(e) => handleInputChange('night_wage_rate', parseFloat(e.target.value))}
          />
        </div>
        
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="flat-rate">{t('defaultFlatWageRate') || 'Default Flat Wage Rate (LE/hr)'}</Label>
          <Input
            id="flat-rate"
            type="number"
            step="0.01"
            value={settings.default_flat_wage_rate || 20.00}
            onChange={(e) => handleInputChange('default_flat_wage_rate', parseFloat(e.target.value))}
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
