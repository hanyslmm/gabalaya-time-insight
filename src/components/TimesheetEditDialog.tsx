import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyTimezone } from '@/hooks/useCompanyTimezone';
import { calculateMorningNightHours } from '@/utils/wageCalculations';
import { Clock, User, Calculator, AlertCircle, Plus, Edit3 } from 'lucide-react';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  employee_id?: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date: string;
  clock_out_time: string;
  total_hours: number;
  morning_hours?: number;
  night_hours?: number;
  total_card_amount_flat: number;
  total_card_amount_split?: number;
  manager_note?: string;
  employee_note?: string;
  organization_id?: string;
}

interface TimesheetEditDialogProps {
  entry: TimesheetEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  employees?: Array<{ id: string; full_name: string; morning_wage_rate?: number; night_wage_rate?: number }>;
  wageSettings?: any;
}

const TimesheetEditDialog: React.FC<TimesheetEditDialogProps> = ({ 
  entry, 
  isOpen,
  onClose, 
  onUpdate,
  employees = [],
  wageSettings
}) => {
  const [formData, setFormData] = useState<Partial<TimesheetEntry>>({});
  const [loading, setLoading] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [calculatedHours, setCalculatedHours] = useState<{ total: number; morning: number; night: number; amount: number } | null>(null);
  const { user } = useAuth();
  const { timezone } = useCompanyTimezone();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (entry) {
      // Format times to HH:MM for the time input (remove seconds and timezone)
      const formatTimeForInput = (time: string) => {
        if (!time) return '';
        // Remove seconds and timezone info: "09:00:00+00:00" -> "09:00"
        return time.split(':').slice(0, 2).join(':');
      };

      setFormData({ 
        ...entry,
        clock_in_time: formatTimeForInput(entry.clock_in_time),
        clock_out_time: formatTimeForInput(entry.clock_out_time)
      });
      setIsNewEntry(false);
      setCalculatedHours(null);
      
      console.log('📝 Editing entry:', {
        original_in_time: entry.clock_in_time,
        formatted_in_time: formatTimeForInput(entry.clock_in_time),
        original_out_time: entry.clock_out_time,
        formatted_out_time: formatTimeForInput(entry.clock_out_time)
      });
    } else {
      // New entry defaults
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        clock_in_date: today,
        clock_in_time: '09:00',
        clock_out_date: today,
        clock_out_time: '17:00',
        total_hours: 0,
        morning_hours: 0,
        night_hours: 0,
        total_card_amount_flat: 0,
        total_card_amount_split: 0,
        manager_note: '',
        employee_note: ''
      });
      setIsNewEntry(true);
      setCalculatedHours(null);
    }
  }, [entry]);

  // Auto-calculate hours when times change
  useEffect(() => {
    if (formData.clock_in_date && formData.clock_in_time && formData.clock_out_date && formData.clock_out_time && formData.employee_id) {
      calculateHours();
    }
  }, [formData.clock_in_date, formData.clock_in_time, formData.clock_out_date, formData.clock_out_time, formData.employee_id]);

  const calculateHours = async () => {
    if (!formData.clock_in_date || !formData.clock_in_time || !formData.clock_out_date || !formData.clock_out_time) return;

    try {
      console.log('🕐 Calculating hours with input times:', {
        clock_in: `${formData.clock_in_date} ${formData.clock_in_time}`,
        clock_out: `${formData.clock_out_date} ${formData.clock_out_time}`,
        timezone
      });

      // Simple local time calculation (no UTC conversion needed for display)
      const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m; // total minutes
      };

      const inMinutes = parseTime(formData.clock_in_time);
      const outMinutes = parseTime(formData.clock_out_time);
      const totalMinutes = outMinutes >= inMinutes ? outMinutes - inMinutes : (24 * 60 - inMinutes + outMinutes);
      const totalHours = totalMinutes / 60;

      // Morning window (8 AM - 5 PM = 480 - 1020 minutes)
      const morningStart = parseTime(wageSettings?.morning_start_time || '08:00:00');
      const morningEnd = parseTime(wageSettings?.morning_end_time || '17:00:00');
      
      // Calculate overlap with morning window
      const shiftStart = inMinutes;
      const shiftEnd = outMinutes >= inMinutes ? outMinutes : outMinutes + 24 * 60;
      
      const morningOverlap = Math.max(0, Math.min(shiftEnd, morningEnd) - Math.max(shiftStart, morningStart));
      const morningHours = morningOverlap / 60;
      const nightHours = Math.max(0, totalHours - morningHours);

      console.log('🕐 Calculation result:', {
        totalHours,
        morningHours,
        nightHours,
        morningWindow: `${wageSettings?.morning_start_time} - ${wageSettings?.morning_end_time}`
      });

      // Get employee rates
      const employee = employees.find(e => e.id === formData.employee_id);
      const morningRate = employee?.morning_wage_rate || wageSettings?.morning_wage_rate || 17;
      const nightRate = employee?.night_wage_rate || wageSettings?.night_wage_rate || 20;
      const amount = (morningHours * morningRate) + (nightHours * nightRate);

      setCalculatedHours({ total: totalHours, morning: morningHours, night: nightHours, amount });
      
      // Auto-update form data
      setFormData(prev => ({
        ...prev,
        total_hours: totalHours,
        morning_hours: morningHours,
        night_hours: nightHours,
        total_card_amount_split: amount
      }));
    } catch (error) {
      console.error('Error calculating hours:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (isNewEntry) {
        // Create new entry
        const { error } = await supabase
          .from('timesheet_entries')
          .insert({
            employee_id: formData.employee_id,
            employee_name: employees.find(e => e.id === formData.employee_id)?.full_name || '',
            organization_id: activeOrganizationId,
            clock_in_date: formData.clock_in_date,
            clock_in_time: formData.clock_in_time,
            clock_out_date: formData.clock_out_date,
            clock_out_time: formData.clock_out_time,
            total_hours: formData.total_hours,
            morning_hours: formData.morning_hours,
            night_hours: formData.night_hours,
            total_card_amount_split: formData.total_card_amount_split,
            total_card_amount_flat: formData.total_card_amount_flat,
            manager_note: formData.manager_note,
            employee_note: formData.employee_note,
          });

        if (error) throw error;
        toast.success('Timesheet entry created successfully');
      } else {
        // Update existing entry
        // Store times as simple TIME (no timezone) - just HH:MM:SS
        const formatTimeForDB = (time: string) => {
          if (!time) return null;
          // Ensure format is HH:MM:SS (add :00 if needed)
          const parts = time.split(':');
          if (parts.length === 2) return `${time}:00`;
          if (parts.length === 3) return time;
          return `${time}:00`;
        };

        const updateData = {
          clock_in_date: formData.clock_in_date,
          clock_in_time: formatTimeForDB(formData.clock_in_time),
          clock_out_date: formData.clock_out_date,
          clock_out_time: formatTimeForDB(formData.clock_out_time),
          total_hours: parseFloat(formData.total_hours?.toFixed(2) || '0'),
          morning_hours: parseFloat(formData.morning_hours?.toFixed(2) || '0'),
          night_hours: parseFloat(formData.night_hours?.toFixed(2) || '0'),
          total_card_amount_split: parseFloat(formData.total_card_amount_split?.toFixed(2) || '0'),
          total_card_amount_flat: parseFloat(formData.total_card_amount_flat?.toFixed(2) || '0'),
          manager_note: formData.manager_note || null,
          employee_note: formData.employee_note || null,
        };

        console.log('💾 Updating timesheet entry:', {
          id: entry.id,
          updateData
        });

        const { data, error } = await supabase
          .from('timesheet_entries')
          .update(updateData)
          .eq('id', entry.id)
          .select();

        console.log('💾 Update response:', { data, error });

        if (error) {
          console.error('❌ Update failed:', error);
          throw error;
        }

        // Verify the update by fetching the entry again
        const { data: verifyData } = await supabase
          .from('timesheet_entries')
          .select('id, clock_in_time, clock_out_time, total_hours, morning_hours, night_hours')
          .eq('id', entry.id)
          .single();

        console.log('✅ Verification after update:', verifyData);

        toast.success('Timesheet entry updated successfully');
      }

      // Aggressively invalidate ALL timesheet-related queries
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries'] });
      
      // Force immediate refetch
      await queryClient.refetchQueries({ queryKey: ['timesheets'] });
      
      // Call parent's onUpdate as well
      onUpdate();
      
      // Small delay to ensure UI updates
      setTimeout(() => {
        onClose();
      }, 200);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast.success('Timesheet entry deleted successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  if (!entry && !isNewEntry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNewEntry ? <Plus className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
            {isNewEntry ? 'Add New Timesheet Entry' : `Edit Timesheet Entry - ${entry?.employee_name}`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Employee Selection (for new entries) */}
          {isNewEntry && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Employee Selection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="employee_select">Select Employee</Label>
                  <Select value={formData.employee_id || ''} onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time Entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clock_in_date">Clock In Date</Label>
                  <Input
                    id="clock_in_date"
                    type="date"
                    value={formData.clock_in_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, clock_in_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clock_in_time">Clock In Time</Label>
                  <Input
                    id="clock_in_time"
                    type="time"
                    value={formData.clock_in_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, clock_in_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clock_out_date">Clock Out Date</Label>
                  <Input
                    id="clock_out_date"
                    type="date"
                    value={formData.clock_out_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, clock_out_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clock_out_time">Clock Out Time</Label>
                  <Input
                    id="clock_out_time"
                    type="time"
                    value={formData.clock_out_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, clock_out_time: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-calculated Hours */}
          {calculatedHours && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Calculator className="h-4 w-4" />
                  Auto-calculated Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{calculatedHours.total.toFixed(2)}h</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{calculatedHours.morning.toFixed(2)}h</div>
                    <div className="text-xs text-muted-foreground">Morning</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{calculatedHours.night.toFixed(2)}h</div>
                    <div className="text-xs text-muted-foreground">Night</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{calculatedHours.amount.toFixed(2)} LE</div>
                    <div className="text-xs text-muted-foreground">Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Override */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Manual Override (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_hours">Total Hours</Label>
                  <Input
                    id="total_hours"
                    type="number"
                    step="0.01"
                    value={formData.total_hours || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_hours: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="morning_hours">Morning Hours</Label>
                  <Input
                    id="morning_hours"
                    type="number"
                    step="0.01"
                    value={formData.morning_hours || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, morning_hours: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="night_hours">Night Hours</Label>
                  <Input
                    id="night_hours"
                    type="number"
                    step="0.01"
                    value={formData.night_hours || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, night_hours: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_card_amount_flat">Flat Amount (LE)</Label>
                  <Input
                    id="total_card_amount_flat"
                    type="number"
                    step="0.01"
                    value={formData.total_card_amount_flat || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_card_amount_flat: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_card_amount_split">Split Amount (LE)</Label>
                  <Input
                    id="total_card_amount_split"
                    type="number"
                    step="0.01"
                    value={formData.total_card_amount_split || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_card_amount_split: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manager_note">Manager Note</Label>
                <Textarea
                  id="manager_note"
                  rows={3}
                  value={formData.manager_note || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, manager_note: e.target.value }))}
                  placeholder="Add manager notes..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_note">Employee Note</Label>
                <Textarea
                  id="employee_note"
                  rows={3}
                  value={formData.employee_note || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, employee_note: e.target.value }))}
                  placeholder="Employee notes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4 border-t">
          {!isNewEntry && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Delete Entry
            </Button>
          )}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || (isNewEntry && !formData.employee_id)}
              className="flex-1 sm:flex-none"
            >
              {loading ? 'Saving...' : (isNewEntry ? 'Create Entry' : 'Save Changes')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimesheetEditDialog;