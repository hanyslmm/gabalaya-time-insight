
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { calculateMorningNightHours } from '@/utils/wageCalculations';

interface WageCalculatorProps {
  selectedRows: string[];
  onCalculationComplete: () => void;
}

const WageCalculator: React.FC<WageCalculatorProps> = ({ selectedRows, onCalculationComplete }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;

  const { data: wageSettings } = useQuery({
    queryKey: ['wage-settings', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      let q: any = (supabase as any)
        .from('wage_settings')
        .select('*');
      if (activeOrganizationId) q = q.eq('organization_id', activeOrganizationId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: selectedEntries } = useQuery({
    queryKey: ['selected-timesheet-entries', selectedRows],
    queryFn: async () => {
      if (selectedRows.length === 0) return [];
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees!inner(
            full_name,
            morning_wage_rate,
            night_wage_rate
          )
        `)
        .in('id', selectedRows);
      
      if (error) {
        throw error;
      }
      
      return data;
    },
    enabled: selectedRows.length > 0
  });

  const calculateSplitWagesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntries || !wageSettings) {
        throw new Error('Missing data for calculation');
      }

      // Get organization timezone
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('timezone')
        .maybeSingle();
      
      const organizationTimezone = companySettings?.timezone || 'Africa/Cairo';

      const updates = await Promise.all(selectedEntries.map(async (entry) => {
        // Use the centralized calculation function with timezone support
        const { morningHours, nightHours } = await calculateMorningNightHours(
          {
            id: entry.id,
            clock_in_date: entry.clock_in_date,
            clock_in_time: entry.clock_in_time,
            clock_out_date: entry.clock_out_date || entry.clock_in_date,
            clock_out_time: entry.clock_out_time || '00:00:00',
            total_hours: entry.total_hours || 0
          },
          wageSettings,
          organizationTimezone
        );

        // Use individual employee rates or fall back to default
        const employeeMorningRate = entry.employees?.morning_wage_rate || wageSettings.morning_wage_rate;
        const employeeNightRate = entry.employees?.night_wage_rate || wageSettings.night_wage_rate;

        const totalSplitAmount = (morningHours * employeeMorningRate) + (nightHours * employeeNightRate);

        return {
          id: entry.id,
          morning_hours: morningHours,
          night_hours: nightHours,
          total_card_amount_split: Math.max(0, parseFloat(totalSplitAmount.toFixed(2))),
          is_split_calculation: true
        };
      }));

      // Update all entries in batch
      for (const update of updates) {
        const { error } = await supabase
          .from('timesheet_entries')
          .update(update)
          .eq('id', update.id);
        
        if (error) {
          throw error;
        }
      }

      return updates;
    },
    onSuccess: (updates) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['selected-timesheet-entries'] });
      toast.success(`${t('wagesCalculated') || 'Split wages calculated successfully'} (${updates.length} entries updated)`);
      onCalculationComplete();
    },
    onError: (error) => {
      toast.error(t('errorCalculatingWages') || 'Error calculating split wages');
    }
  });

  const handleCalculateSplitWages = () => {
    if (selectedRows.length === 0) {
      toast.error(t('selectRowsFirst') || 'Please select rows to calculate split wages');
      return;
    }

    calculateSplitWagesMutation.mutate();
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleCalculateSplitWages}
        disabled={selectedRows.length === 0 || calculateSplitWagesMutation.isPending}
        className="w-full flex items-center space-x-2"
        variant="outline"
      >
        <Calculator className="h-4 w-4" />
        <span>
          {calculateSplitWagesMutation.isPending 
            ? (t('calculating') || 'Calculating...') 
            : (t('splitSelectedWages') || 'Split Selected Wages')
          }
        </span>
      </Button>
      
      {selectedRows.length > 0 && (
        <p className="text-xs text-gray-600 text-center">
          {selectedRows.length} {t('rowsSelected') || 'rows selected'}
        </p>
      )}
    </div>
  );
};

export default WageCalculator;
