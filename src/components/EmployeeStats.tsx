
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  role: string;
  hiring_date: string;
}

interface EmployeeStatsProps {
  employee: Employee;
  onClose: () => void;
}

const EmployeeStats: React.FC<EmployeeStatsProps> = ({ employee, onClose }) => {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['employee-stats', employee.id],
    queryFn: async () => {
      console.log('Fetching stats for employee:', employee.full_name);
      
      // Query timesheet entries by employee name since that's what we have in the data
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('employee_name', employee.full_name);

      if (error) {
        console.error('Error fetching timesheet entries:', error);
        throw error;
      }

      console.log('Found timesheet entries:', data);
      const entries = data || [];
      const totalShifts = entries.length;
      
      // Calculate total hours from all available hour fields
      const totalHours = entries.reduce((sum, entry) => {
        const regularHours = entry.total_hours || 0;
        const morningHours = entry.morning_hours || 0;
        const nightHours = entry.night_hours || 0;
        
        // Use the maximum of total_hours or (morning_hours + night_hours)
        const calculatedHours = Math.max(regularHours, morningHours + nightHours);
        return sum + calculatedHours;
      }, 0);

      // Calculate total amount from both flat and split calculations
      const totalAmount = entries.reduce((sum, entry) => {
        const flatAmount = entry.total_card_amount_flat || 0;
        const splitAmount = entry.total_card_amount_split || 0;
        
        // Use split amount if available, otherwise use flat amount
        const amount = entry.is_split_calculation ? splitAmount : flatAmount;
        return sum + amount;
      }, 0);

      return {
        totalShifts,
        totalHours: totalHours.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        averageHours: totalShifts > 0 ? (totalHours / totalShifts).toFixed(2) : '0.00'
      };
    }
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Employee Statistics - {employee.full_name}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hiring Date</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Date(employee.hiring_date).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalShifts || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalHours || '0.00'}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalAmount || '0.00'} LE</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Average Hours per Shift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stats?.averageHours || '0.00'} hours</div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeStats;
