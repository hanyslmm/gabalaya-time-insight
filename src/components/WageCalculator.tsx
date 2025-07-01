import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface WageCalculatorProps {
  selectedRows: string[];
  onCalculationComplete: () => void;
}

const WageCalculator: React.FC<WageCalculatorProps> = ({ selectedRows, onCalculationComplete }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: wageSettings } = useQuery({
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

  const { data: selectedEntries } = useQuery({
    queryKey: ['selected-timesheet-entries', selectedRows],
    queryFn: async () => {
      if (selectedRows.length === 0) return [];
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select(`
          *,
          employees (
            morning_wage_rate,
            night_wage_rate
          )
        `)
        .in('id', selectedRows);
      
      if (error) throw error;
      return data;
    },
    enabled: selectedRows.length > 0
  });

  const calculateSplitWagesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntries || !wageSettings) {
        throw new Error('Missing data for calculation');
      }

      const updates = selectedEntries.map(entry => {
        // Parse times
        const clockInTime = new Date(`${entry.clock_in_date} ${entry.clock_in_time}`);
        const clockOutTime = new Date(`${entry.clock_out_date} ${entry.clock_out_time}`);
        
        // Handle next day scenario for night shifts
        if (clockOutTime < clockInTime) {
          clockOutTime.setDate(clockOutTime.getDate() + 1);
        }

        const morningStart = new Date(clockInTime);
        morningStart.setHours(parseInt(wageSettings.morning_start_time.split(':')[0]), 
                             parseInt(wageSettings.morning_start_time.split(':')[1]), 0);
        
        const morningEnd = new Date(clockInTime);
        morningEnd.setHours(parseInt(wageSettings.morning_end_time.split(':')[0]), 
                           parseInt(wageSettings.morning_end_time.split(':')[1]), 0);
        
        const nightStart = new Date(clockInTime);
        nightStart.setHours(parseInt(wageSettings.night_start_time.split(':')[0]), 
                           parseInt(wageSettings.night_start_time.split(':')[1]), 0);
        
        const nightEnd = new Date(clockInTime);
        nightEnd.setHours(parseInt(wageSettings.night_end_time.split(':')[0]), 
                         parseInt(wageSettings.night_end_time.split(':')[1]), 0);
        
        // Handle next day for night end time
        if (nightEnd < nightStart) {
          nightEnd.setDate(nightEnd.getDate() + 1);
        }

        let morningHours = 0;
        let nightHours = 0;

        // Calculate morning hours
        const morningOverlapStart = new Date(Math.max(clockInTime.getTime(), morningStart.getTime()));
        const morningOverlapEnd = new Date(Math.min(clockOutTime.getTime(), morningEnd.getTime()));
        
        if (morningOverlapEnd > morningOverlapStart) {
          morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
        }

        // Calculate night hours
        const nightOverlapStart = new Date(Math.max(clockInTime.getTime(), nightStart.getTime()));
        const nightOverlapEnd = new Date(Math.min(clockOutTime.getTime(), nightEnd.getTime()));
        
        if (nightOverlapEnd > nightOverlapStart) {
          nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
        }

        // Ensure total hours don't exceed actual worked hours
        const totalWorkedHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        const calculatedTotal = morningHours + nightHours;
        
        if (calculatedTotal > totalWorkedHours) {
          const ratio = totalWorkedHours / calculatedTotal;
          morningHours *= ratio;
          nightHours *= ratio;
        }

        // Use individual employee rates or fall back to default
        const employeeMorningRate = entry.employees?.morning_wage_rate || wageSettings.morning_wage_rate;
        const employeeNightRate = entry.employees?.night_wage_rate || wageSettings.night_wage_rate;

        const totalSplitAmount = (morningHours * employeeMorningRate) + 
                                (nightHours * employeeNightRate);

        return {
          id: entry.id,
          morning_hours: Math.max(0, morningHours),
          night_hours: Math.max(0, nightHours),
          total_card_amount_split: Math.max(0, totalSplitAmount),
          is_split_calculation: true
        };
      });

      // Update all entries in batch
      for (const update of updates) {
        const { error } = await supabase
          .from('timesheet_entries')
          .update(update)
          .eq('id', update.id);
        
        if (error) throw error;
      }

      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['selected-timesheet-entries'] });
      toast.success(t('wagesCalculated') || 'Split wages calculated successfully');
      onCalculationComplete();
    },
    onError: (error) => {
      console.error('Error calculating split wages:', error);
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
