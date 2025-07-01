
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
      
      if (error) {
        console.error('Error fetching wage settings:', error);
        throw error;
      }
      return data;
    }
  });

  const { data: selectedEntries } = useQuery({
    queryKey: ['selected-timesheet-entries', selectedRows],
    queryFn: async () => {
      if (selectedRows.length === 0) return [];
      
      console.log('Fetching selected entries for IDs:', selectedRows);
      
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
        console.error('Error fetching selected entries:', error);
        throw error;
      }
      
      console.log('Selected entries with employee data:', data);
      return data;
    },
    enabled: selectedRows.length > 0
  });

  const calculateSplitWagesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntries || !wageSettings) {
        throw new Error('Missing data for calculation');
      }

      console.log('Starting wage calculation with settings:', wageSettings);
      console.log('Processing entries:', selectedEntries);

      const updates = selectedEntries.map(entry => {
        console.log('Processing entry for:', entry.employee_name);
        
        // Parse times - handle both date and time
        const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
        const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
        
        console.log('Clock in:', clockInDateTime);
        console.log('Clock out:', clockOutDateTime);
        
        // Handle next day scenario for night shifts
        if (clockOutDateTime < clockInDateTime) {
          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
        }

        // Create time boundaries for the same day as clock in
        const baseDate = new Date(entry.clock_in_date);
        
        const morningStart = new Date(baseDate);
        const [morningStartHour, morningStartMin] = wageSettings.morning_start_time.split(':');
        morningStart.setHours(parseInt(morningStartHour), parseInt(morningStartMin), 0, 0);
        
        const morningEnd = new Date(baseDate);
        const [morningEndHour, morningEndMin] = wageSettings.morning_end_time.split(':');
        morningEnd.setHours(parseInt(morningEndHour), parseInt(morningEndMin), 0, 0);
        
        const nightStart = new Date(baseDate);
        const [nightStartHour, nightStartMin] = wageSettings.night_start_time.split(':');
        nightStart.setHours(parseInt(nightStartHour), parseInt(nightStartMin), 0, 0);
        
        const nightEnd = new Date(baseDate);
        const [nightEndHour, nightEndMin] = wageSettings.night_end_time.split(':');
        nightEnd.setHours(parseInt(nightEndHour), parseInt(nightEndMin), 0, 0);
        
        // Handle next day for night end time if it's earlier than night start
        if (nightEnd <= nightStart) {
          nightEnd.setDate(nightEnd.getDate() + 1);
        }

        console.log('Time boundaries:', {
          morningStart: morningStart.toISOString(),
          morningEnd: morningEnd.toISOString(),
          nightStart: nightStart.toISOString(),
          nightEnd: nightEnd.toISOString()
        });

        let morningHours = 0;
        let nightHours = 0;

        // Calculate morning hours overlap
        const morningOverlapStart = new Date(Math.max(clockInDateTime.getTime(), morningStart.getTime()));
        const morningOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), morningEnd.getTime()));
        
        if (morningOverlapEnd > morningOverlapStart) {
          morningHours = (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
        }

        // Calculate night hours overlap
        const nightOverlapStart = new Date(Math.max(clockInDateTime.getTime(), nightStart.getTime()));
        const nightOverlapEnd = new Date(Math.min(clockOutDateTime.getTime(), nightEnd.getTime()));
        
        if (nightOverlapEnd > nightOverlapStart) {
          nightHours = (nightOverlapEnd.getTime() - nightOverlapStart.getTime()) / (1000 * 60 * 60);
        }

        console.log('Calculated hours:', { morningHours, nightHours });

        // Ensure total hours don't exceed actual worked hours
        const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
        const calculatedTotal = morningHours + nightHours;
        
        if (calculatedTotal > totalWorkedHours) {
          const ratio = totalWorkedHours / calculatedTotal;
          morningHours *= ratio;
          nightHours *= ratio;
          console.log('Adjusted hours due to total limit:', { morningHours, nightHours });
        }

        // Use individual employee rates or fall back to default
        const employeeMorningRate = entry.employees?.morning_wage_rate || wageSettings.morning_wage_rate;
        const employeeNightRate = entry.employees?.night_wage_rate || wageSettings.night_wage_rate;

        console.log('Using rates:', { employeeMorningRate, employeeNightRate });

        const totalSplitAmount = (morningHours * employeeMorningRate) + (nightHours * employeeNightRate);

        console.log('Final calculation:', {
          morningHours: morningHours.toFixed(2),
          nightHours: nightHours.toFixed(2),
          totalSplitAmount: totalSplitAmount.toFixed(2)
        });

        return {
          id: entry.id,
          morning_hours: Math.max(0, parseFloat(morningHours.toFixed(2))),
          night_hours: Math.max(0, parseFloat(nightHours.toFixed(2))),
          total_card_amount_split: Math.max(0, parseFloat(totalSplitAmount.toFixed(2))),
          is_split_calculation: true
        };
      });

      console.log('Updates to apply:', updates);

      // Update all entries in batch
      for (const update of updates) {
        console.log('Updating entry:', update.id, update);
        const { error } = await supabase
          .from('timesheet_entries')
          .update(update)
          .eq('id', update.id);
        
        if (error) {
          console.error('Error updating entry:', update.id, error);
          throw error;
        }
      }

      return updates;
    },
    onSuccess: (updates) => {
      console.log('Successfully updated entries:', updates);
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['selected-timesheet-entries'] });
      toast.success(`${t('wagesCalculated') || 'Split wages calculated successfully'} (${updates.length} entries updated)`);
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

    console.log('Starting split wage calculation for rows:', selectedRows);
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
