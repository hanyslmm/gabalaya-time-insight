import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfMonth, endOfMonth } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

interface PayPeriodSettings {
  mode: 'fixed_day' | 'month_dynamic';
  endDay: number;
}

export const usePayPeriodSettings = () => {
  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['pay-period-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      console.log('usePayPeriodSettings: Fetching via RPC for org:', activeOrganizationId);
      const { data, error } = await supabase.rpc('get_company_pay_period_settings' as any, {
        p_organization_id: activeOrganizationId
      } as any);

      if (error) {
        console.error('usePayPeriodSettings: Error fetching via RPC:', error);
        throw error;
      }

      const d: any = data as any;
      const result = {
        mode: (d?.pay_period_mode as 'fixed_day' | 'month_dynamic') || 'fixed_day',
        endDay: d?.pay_period_end_day || 28
      } as PayPeriodSettings;

      console.log('usePayPeriodSettings: Raw data from RPC:', data);
      console.log('usePayPeriodSettings: Parsed result:', result);
      
      // Warn if using defaults (indicates missing database columns or settings)
      if (!d?.pay_period_mode || !d?.pay_period_end_day) {
        console.warn(
          '⚠️ usePayPeriodSettings: Using default pay period settings. ' +
          'This may indicate database migrations are not applied. ' +
          'Check supabase/migrations for pay_period_settings migrations.'
        );
      }
      
      return result;
    }
  });

  const calculatePayPeriod = (offsetMonths: number = 0): DateRange => {
    const mode = settings?.mode || 'fixed_day';
    const endDay = settings?.endDay || 28;
    const today = new Date();

    if (mode === 'month_dynamic') {
      // Full calendar month mode
      const targetMonth = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
      return {
        from: startOfMonth(targetMonth),
        to: endOfMonth(targetMonth)
      };
    } else {
      // Fixed day mode
      const currentDay = today.getDate();
      let endDate: Date;
      
      if (offsetMonths === 0) {
        // Current period logic
        if (currentDay <= endDay) {
          endDate = new Date(today.getFullYear(), today.getMonth(), endDay);
        } else {
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, endDay);
        }
      } else {
        // For previous/next periods
        const targetMonth = today.getMonth() + offsetMonths;
        if (currentDay <= endDay) {
          endDate = new Date(today.getFullYear(), targetMonth, endDay);
        } else {
          endDate = new Date(today.getFullYear(), targetMonth + 1, endDay);
        }
      }
      
      // Start date is the day after the previous period's end
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(endDay + 1);
      
      return { from: startDate, to: endDate };
    }
  };

  return {
    settings,
    isLoading,
    calculatePayPeriod,
    mode: settings?.mode || 'fixed_day',
    endDay: settings?.endDay || 28
  };
};

