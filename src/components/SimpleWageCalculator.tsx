import React from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SimpleWageCalculator: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch wage settings
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

  const calculateAllMutation = useMutation({
    mutationFn: async () => {
      if (!wageSettings) {
        throw new Error('Wage settings not found');
      }

      // Get all timesheet entries that need calculation
      const { data: entries, error: entriesError } = await supabase
        .from('timesheet_entries')
        .select('*')
        .or('is_split_calculation.is.null,is_split_calculation.eq.false')
        .not('clock_out_time', 'is', null);
      
      if (entriesError) {
        throw new Error('Failed to fetch timesheet entries');
      }

      if (!entries || entries.length === 0) {
        toast.info('No entries found to calculate');
        return;
      }

      // Calculate and update each entry
      for (const entry of entries) {
        // Simple calculation: assign morning hours based on time worked
        const clockInDateTime = new Date(`${entry.clock_in_date}T${entry.clock_in_time}`);
        const clockOutDateTime = new Date(`${entry.clock_out_date}T${entry.clock_out_time}`);
        
        if (clockOutDateTime < clockInDateTime) {
          clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
        }

        const totalWorkedHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
        
        // Simple logic: if shift starts before 17:00, consider it morning shift
        const clockInHour = clockInDateTime.getHours();
        let morningHours = 0;
        let nightHours = 0;
        
        if (clockInHour < 17) {
          morningHours = Math.min(totalWorkedHours, 9); // Max 9 hours morning
          nightHours = Math.max(0, totalWorkedHours - 9);
        } else {
          nightHours = totalWorkedHours;
        }
        
        // Update the entry
        const { error: updateError } = await supabase
          .from('timesheet_entries')
          .update({
            morning_hours: Math.max(0, parseFloat(morningHours.toFixed(2))),
            night_hours: Math.max(0, parseFloat(nightHours.toFixed(2))),
            is_split_calculation: true
          })
          .eq('id', entry.id);
        
        if (updateError) {
          console.error(`Failed to update entry ${entry.id}:`, updateError);
        }
      }

      return entries.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      toast.success(`Successfully calculated hours for ${count} entries!`);
    },
    onError: (error) => {
      toast.error('Failed to calculate hours: ' + error.message);
    }
  });

  return (
    <Button
      onClick={() => calculateAllMutation.mutate()}
      disabled={calculateAllMutation.isPending || !wageSettings}
      variant="outline"
      size="sm"
      className="flex items-center gap-2 w-full"
    >
      {calculateAllMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Calculator className="h-4 w-4" />
      )}
      <span>
        {calculateAllMutation.isPending ? 'Calculating...' : 'Calculate Hours'}
      </span>
    </Button>
  );
};

export default SimpleWageCalculator;