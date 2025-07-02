import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit3, Save, X } from 'lucide-react';
import { format } from 'date-fns';

interface TimesheetEntry {
  id: string;
  employee_name: string;
  clock_in_date: string;
  clock_in_time: string;
  clock_out_date: string;
  clock_out_time: string;
  total_hours: number;
  total_card_amount_flat: number;
  manager_note?: string;
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
  const [formData, setFormData] = useState({
    clock_in_date: '',
    clock_in_time: '',
    clock_out_date: '',
    clock_out_time: '',
    manager_note: ''
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (entry) {
      setFormData({
        clock_in_date: entry.clock_in_date || '',
        clock_in_time: entry.clock_in_time || '',
        clock_out_date: entry.clock_out_date || '',
        clock_out_time: entry.clock_out_time || '',
        manager_note: entry.manager_note || ''
      });
    }
  }, [entry]);

  const calculateTotalHours = () => {
    if (!formData.clock_in_date || !formData.clock_in_time || !formData.clock_out_date || !formData.clock_out_time) {
      return 0;
    }

    const clockIn = new Date(`${formData.clock_in_date}T${formData.clock_in_time}`);
    const clockOut = new Date(`${formData.clock_out_date}T${formData.clock_out_time}`);
    
    if (clockOut <= clockIn) {
      return 0;
    }

    return (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  };

  const handleSave = async () => {
    if (!entry) return;

    setLoading(true);
    try {
      const totalHours = calculateTotalHours();
      
      const { error } = await supabase
        .from('timesheet_entries')
        .update({
          clock_in_date: formData.clock_in_date,
          clock_in_time: formData.clock_in_time,
          clock_out_date: formData.clock_out_date,
          clock_out_time: formData.clock_out_time,
          total_hours: totalHours,
          manager_note: formData.manager_note,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (error) throw error;

      toast.success('Timesheet updated successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update timesheet');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = calculateTotalHours();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Timesheet - {entry?.employee_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clock_in_date">Clock In Date</Label>
              <Input
                id="clock_in_date"
                type="date"
                value={formData.clock_in_date}
                onChange={(e) => setFormData(prev => ({ ...prev, clock_in_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="clock_in_time">Clock In Time</Label>
              <Input
                id="clock_in_time"
                type="time"
                value={formData.clock_in_time}
                onChange={(e) => setFormData(prev => ({ ...prev, clock_in_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clock_out_date">Clock Out Date</Label>
              <Input
                id="clock_out_date"
                type="date"
                value={formData.clock_out_date}
                onChange={(e) => setFormData(prev => ({ ...prev, clock_out_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="clock_out_time">Clock Out Time</Label>
              <Input
                id="clock_out_time"
                type="time"
                value={formData.clock_out_time}
                onChange={(e) => setFormData(prev => ({ ...prev, clock_out_time: e.target.value }))}
              />
            </div>
          </div>

          {totalHours > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Calculated Hours:</strong> {totalHours.toFixed(2)} hours
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="manager_note">Manager Notes</Label>
            <Textarea
              id="manager_note"
              placeholder="Add notes about this timesheet entry..."
              value={formData.manager_note}
              onChange={(e) => setFormData(prev => ({ ...prev, manager_note: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || totalHours <= 0}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimesheetEditDialog;