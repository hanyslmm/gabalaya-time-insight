
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [morningRate, setMorningRate] = useState(employee.morning_wage_rate || 17.00);
  const [nightRate, setNightRate] = useState(employee.night_wage_rate || 20.00);

  const updateRatesMutation = useMutation({
    mutationFn: async () => {
      console.log('Updating wage rates for employee:', {
        employeeId: employee.id,
        employeeName: employee.full_name,
        isAdminUser: (employee as any).is_admin_user,
        oldRates: { morning: employee.morning_wage_rate, night: employee.night_wage_rate },
        newRates: { morning: morningRate, night: nightRate }
      });

      // If this is an admin user (from admin_users table), we need to handle it differently
      if ((employee as any).is_admin_user) {
        // First, check if an employee record exists for this admin user
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('*')
          .eq('staff_id', employee.staff_id)
          .maybeSingle();

        if (existingEmployee) {
          // Update existing employee record
          const { data, error } = await supabase
            .from('employees')
            .update({
              morning_wage_rate: morningRate,
              night_wage_rate: nightRate
            })
            .eq('staff_id', employee.staff_id)
            .select();
          
          if (error) throw error;
          console.log('Updated existing employee record:', data);
          return data;
        } else {
          // Create new employee record for admin user
          const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
          const { data, error } = await supabase
            .from('employees')
            .insert({
              staff_id: employee.staff_id,
              full_name: employee.full_name,
              role: 'Employee', // Default role
              hiring_date: new Date().toISOString().split('T')[0],
              morning_wage_rate: morningRate,
              night_wage_rate: nightRate,
              organization_id: activeOrganizationId
            })
            .select();
          
          if (error) throw error;
          console.log('Created new employee record for admin user:', data);
          return data;
        }
      } else {
        // Regular employee - update directly
        const { data, error } = await supabase
          .from('employees')
          .update({
            morning_wage_rate: morningRate,
            night_wage_rate: nightRate
          })
          .eq('id', employee.id)
          .select();
        
        if (error) throw error;
        console.log('Updated regular employee record:', data);
        return data;
      }
    },
    onSuccess: (data) => {
      console.log('Wage rates update successful, invalidating caches...');
      
      // Invalidate all employee-related queries with proper organization scoping
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['employees-for-orgs'] }); // For organization management
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }); // For dashboard wage calculations
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] }); // For dashboard charts
      
      console.log('Cache invalidation complete');
      toast.success('Wage rates updated successfully');
      onClose();
    },
    onError: (error) => {
      console.error('Wage rates update failed:', error);
      toast.error(`Error updating wage rates: ${error.message}`);
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
