import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  employees?: { full_name?: string; staff_id?: string };
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
}

interface TimesheetEditDialogProps {
  entry: TimesheetEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const TimesheetEditDialog: React.FC<TimesheetEditDialogProps> = ({ 
  entry, 
  isOpen,
  onClose, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState<Partial<TimesheetEntry>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({ ...entry });
    }
  }, [entry]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('timesheet_entries')
        .update({
          clock_in_date: formData.clock_in_date,
          clock_in_time: formData.clock_in_time,
          clock_out_date: formData.clock_out_date,
          clock_out_time: formData.clock_out_time,
          total_hours: formData.total_hours,
          morning_hours: formData.morning_hours,
          night_hours: formData.night_hours,
          total_card_amount_flat: formData.total_card_amount_flat,
          total_card_amount_split: formData.total_card_amount_split,
          manager_note: formData.manager_note,
          employee_note: formData.employee_note,
        })
        .eq('id', entry.id);

      if (error) throw error;

      toast.success('Timesheet entry updated successfully');
      onUpdate();
      onClose();
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

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Timesheet Entry - {entry.employees?.full_name || entry.employee_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Basic Info */}
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

          {/* Hours */}
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

          {/* Amounts */}
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

          {/* Notes */}
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
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4 border-t">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Delete Entry
          </Button>
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
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimesheetEditDialog;