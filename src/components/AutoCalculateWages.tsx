import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { calculateAllTimesheetHours } from '@/utils/wageCalculations';

const AutoCalculateWages: React.FC = () => {
  const queryClient = useQueryClient();

  const calculateAllMutation = useMutation({
    mutationFn: calculateAllTimesheetHours,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      toast.success('All timesheet hours calculated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to calculate hours: ' + error.message);
    }
  });

  return (
    <Button
      onClick={() => calculateAllMutation.mutate()}
      disabled={calculateAllMutation.isPending}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      {calculateAllMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Calculator className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {calculateAllMutation.isPending ? 'Calculating...' : 'Auto-Calculate Hours'}
      </span>
    </Button>
  );
};

export default AutoCalculateWages;