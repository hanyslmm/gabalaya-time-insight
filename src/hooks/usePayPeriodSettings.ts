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
      console.log('usePayPeriodSettings: Fetching for org:', activeOrganizationId);
      const { data, error } = await supabase
        .from('company_settings')
        .select('pay_period_mode, pay_period_end_day')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (error) {
        console.error('usePayPeriodSettings: Error fetching:', error);
        throw error;
      }
      
      const result = {
        mode: (data?.pay_period_mode as 'fixed_day' | 'month_dynamic') || 'fixed_day',
        endDay: data?.pay_period_end_day || 28
      } as PayPeriodSettings;
      
      console.log('usePayPeriodSettings: Result:', result);
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

