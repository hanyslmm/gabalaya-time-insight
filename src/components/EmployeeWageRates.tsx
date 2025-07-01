
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Employee {
  id: string;
  full_name: string;
  staff_id: string;
  morning_wage_rate?: number;
  night_wage_rate?: number;
}

interface EmployeeWageRatesProps {
  employee: Employee;
  onClose: () => void;
}

const EmployeeWageRates: React.FC<EmployeeWageRatesProps> = ({ employee, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [morningRate, setMorningRate] = useState(employee.morning_wage_rate || 17.00);
  const [nightRate, setNightRate] = useState(employee.night_wage_rate || 20.00);

  const updateRatesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employees')
        .update({
          morning_wage_rate: morningRate,
          night_wage_rate: nightRate
        })
        .eq('id', employee.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Wage rates updated successfully');
      onClose();
    },
    onError: (error) => {
      console.error('Error updating wage rates:', error);
      toast.error('Error updating wage rates');
    }
  });

  const handleSave = () => {
    updateRatesMutation.mutate();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('setWageRates') || 'Set Wage Rates'} - {employee.full_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="morning-rate">
              {t('morningWageRate') || 'Morning Wage Rate'} (LE/hr)
            </Label>
            <Input
              id="morning-rate"
              type="number"
              step="0.01"
              value={morningRate}
              onChange={(e) => setMorningRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="night-rate">
              {t('nightWageRate') || 'Night Wage Rate'} (LE/hr)
            </Label>
            <Input
              id="night-rate"
              type="number"
              step="0.01"
              value={nightRate}
              onChange={(e) => setNightRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={handleSave}
              disabled={updateRatesMutation.isPending}
              className="flex-1"
            >
              {updateRatesMutation.isPending ? 'Saving...' : 'Save Rates'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeWageRates;
