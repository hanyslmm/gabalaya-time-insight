import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Info, Save } from 'lucide-react';
import { toast } from 'sonner';

const PayPeriodSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  
  const [payPeriodMode, setPayPeriodMode] = useState<'fixed_day' | 'month_dynamic'>('fixed_day');
  const [payPeriodEndDay, setPayPeriodEndDay] = useState(28);

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['pay-period-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('pay_period_mode, pay_period_end_day')
        .eq('organization_id', activeOrganizationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  // Update local state when settings are fetched
  useEffect(() => {
    if (currentSettings) {
      setPayPeriodMode(currentSettings.pay_period_mode || 'fixed_day');
      setPayPeriodEndDay(currentSettings.pay_period_end_day || 28);
    }
  }, [currentSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log('Saving pay period settings for organization:', activeOrganizationId);
      const { error } = await supabase
        .from('company_settings')
        .update({
          pay_period_mode: payPeriodMode,
          pay_period_end_day: payPeriodEndDay,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-period-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Pay period settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings');
    }
  });

  const handleSave = () => {
    if (payPeriodMode === 'fixed_day') {
      if (payPeriodEndDay < 1 || payPeriodEndDay > 31) {
        toast.error('Pay period end day must be between 1 and 31');
        return;
      }
      if (isNaN(payPeriodEndDay)) {
        toast.error('Please enter a valid day number');
        return;
      }
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Pay Period Configuration
        </CardTitle>
        <CardDescription>
          Configure how pay periods are calculated across Reports and Timesheets for the current organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pay Period Mode */}
        <div className="space-y-4">
          <Label>Pay Period Mode</Label>
          <RadioGroup value={payPeriodMode} onValueChange={(value: any) => setPayPeriodMode(value)}>
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="fixed_day" id="fixed_day" />
              <div className="flex-1">
                <Label htmlFor="fixed_day" className="font-medium cursor-pointer">
                  Fixed Day Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pay period ends on a specific day each month (e.g., 28th of every month)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="month_dynamic" id="month_dynamic" />
              <div className="flex-1">
                <Label htmlFor="month_dynamic" className="font-medium cursor-pointer">
                  Full Calendar Month
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pay period follows the full calendar month (1st to last day, adjusts for 28/29/30/31 days)
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Pay Period End Day (only for fixed_day mode) */}
        {payPeriodMode === 'fixed_day' && (
          <div className="space-y-2">
            <Label htmlFor="endDay">Pay Period End Day</Label>
            <Input
              id="endDay"
              type="number"
              min="1"
              max="31"
              value={payPeriodEndDay}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 31) {
                  setPayPeriodEndDay(value);
                } else if (e.target.value === '') {
                  setPayPeriodEndDay(1); // Default to 1 if empty
                }
              }}
              onBlur={(e) => {
                const value = parseInt(e.target.value);
                if (!value || value < 1) {
                  setPayPeriodEndDay(1);
                } else if (value > 31) {
                  setPayPeriodEndDay(31);
                }
              }}
              className="w-32"
              placeholder="1-31"
            />
            <p className="text-xs text-muted-foreground">
              The day of the month when the pay period ends (1-31)
            </p>
          </div>
        )}

        {/* Example */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Example:</strong> 
            {payPeriodMode === 'fixed_day' && (
              <span> If set to day {payPeriodEndDay}, the current pay period will run from {new Date().getMonth() === 0 ? 'Dec' : new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', { month: 'short' })} {payPeriodEndDay + 1} to {new Date().toLocaleDateString('en-US', { month: 'short' })} {payPeriodEndDay}.</span>
            )}
            {payPeriodMode === 'month_dynamic' && (
              <span> The current pay period will be {new Date().toLocaleDateString('en-US', { month: 'long' })} 1 to {new Date().toLocaleDateString('en-US', { month: 'long' })} {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}.</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="w-full sm:w-auto"
          >
            {saveMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PayPeriodSettings;

