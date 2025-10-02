import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { JUSTIFICATION_CATEGORIES } from '@/constants/timesheetRequestReasons';
import { format } from 'date-fns';

interface TimesheetChangeRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requestType: 'edit' | 'add' | 'delete';
  originalEntry?: any;
  onSuccess?: () => void;
}

export const TimesheetChangeRequestDialog = ({
  isOpen,
  onClose,
  requestType,
  originalEntry,
  onSuccess,
}: TimesheetChangeRequestDialogProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    clockInDate: originalEntry?.clock_in_date || '',
    clockInTime: originalEntry?.clock_in_time || '',
    clockOutDate: originalEntry?.clock_out_date || '',
    clockOutTime: originalEntry?.clock_out_time || '',
    clockInLocation: originalEntry?.clock_in_location || 'Office',
    clockOutLocation: originalEntry?.clock_out_location || 'Office',
    justificationCategory: '',
    justificationDetails: '',
  });

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to submit a request');
      return;
    }

    if (!formData.justificationCategory) {
      toast.error('Please select a justification reason');
      return;
    }

    if (formData.justificationCategory === 'other' && !formData.justificationDetails.trim()) {
      toast.error('Please provide details for "Other" justification');
      return;
    }

    if (requestType !== 'delete') {
      if (!formData.clockInDate || !formData.clockInTime) {
        toast.error('Please provide clock in date and time');
        return;
      }
      if (!formData.clockOutDate || !formData.clockOutTime) {
        toast.error('Please provide clock out date and time');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id, full_name, organization_id')
        .eq('staff_id', user.username)
        .single();

      if (!employee) {
        throw new Error('Employee record not found');
      }

      const requestData: any = {
        employee_id: employee.id,
        employee_name: employee.full_name,
        organization_id: employee.organization_id,
        request_type: requestType,
        justification_category: formData.justificationCategory,
        justification_details: formData.justificationDetails || null,
        status: 'pending',
      };

      // Add original entry data for edit/delete requests
      if (requestType !== 'add' && originalEntry) {
        requestData.original_entry_id = originalEntry.id;
        requestData.original_clock_in_date = originalEntry.clock_in_date;
        requestData.original_clock_in_time = originalEntry.clock_in_time;
        requestData.original_clock_out_date = originalEntry.clock_out_date;
        requestData.original_clock_out_time = originalEntry.clock_out_time;
      }

      // Add requested changes for edit/add requests
      if (requestType !== 'delete') {
        requestData.requested_clock_in_date = formData.clockInDate;
        requestData.requested_clock_in_time = formData.clockInTime;
        requestData.requested_clock_out_date = formData.clockOutDate;
        requestData.requested_clock_out_time = formData.clockOutTime;
        requestData.requested_clock_in_location = formData.clockInLocation;
        requestData.requested_clock_out_location = formData.clockOutLocation;
      }

      const { error } = await supabase
        .from('timesheet_change_requests')
        .insert(requestData);

      if (error) throw error;

      toast.success('Request submitted successfully!');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (requestType) {
      case 'edit':
        return 'Request to Edit Timesheet Entry';
      case 'add':
        return 'Request to Add New Timesheet Entry';
      case 'delete':
        return 'Request to Delete Timesheet Entry';
    }
  };

  const getDialogDescription = () => {
    switch (requestType) {
      case 'edit':
        return 'Submit a request to modify an existing timesheet entry. Your manager will review and approve or reject this request.';
      case 'add':
        return 'Submit a request to add a new timesheet entry. Your manager will review and approve or reject this request.';
      case 'delete':
        return 'Submit a request to delete this timesheet entry. Your manager will review and approve or reject this request.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show original values for edit/delete requests */}
          {(requestType === 'edit' || requestType === 'delete') && originalEntry && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">Current Entry:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Clock In:</span>{' '}
                  {format(new Date(originalEntry.clock_in_date), 'MMM dd, yyyy')} at {originalEntry.clock_in_time}
                </div>
                <div>
                  <span className="text-muted-foreground">Clock Out:</span>{' '}
                  {originalEntry.clock_out_date && originalEntry.clock_out_time
                    ? `${format(new Date(originalEntry.clock_out_date), 'MMM dd, yyyy')} at ${originalEntry.clock_out_time}`
                    : 'Not clocked out'}
                </div>
              </div>
            </div>
          )}

          {/* Requested changes (for edit/add only) */}
          {requestType !== 'delete' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clockInDate">Clock In Date *</Label>
                  <Input
                    id="clockInDate"
                    type="date"
                    value={formData.clockInDate}
                    onChange={(e) => setFormData({ ...formData, clockInDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockInTime">Clock In Time *</Label>
                  <Input
                    id="clockInTime"
                    type="time"
                    value={formData.clockInTime}
                    onChange={(e) => setFormData({ ...formData, clockInTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clockOutDate">Clock Out Date *</Label>
                  <Input
                    id="clockOutDate"
                    type="date"
                    value={formData.clockOutDate}
                    onChange={(e) => setFormData({ ...formData, clockOutDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockOutTime">Clock Out Time *</Label>
                  <Input
                    id="clockOutTime"
                    type="time"
                    value={formData.clockOutTime}
                    onChange={(e) => setFormData({ ...formData, clockOutTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clockInLocation">Clock In Location</Label>
                  <Input
                    id="clockInLocation"
                    value={formData.clockInLocation}
                    onChange={(e) => setFormData({ ...formData, clockInLocation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockOutLocation">Clock Out Location</Label>
                  <Input
                    id="clockOutLocation"
                    value={formData.clockOutLocation}
                    onChange={(e) => setFormData({ ...formData, clockOutLocation: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Justification */}
          <div className="space-y-2">
            <Label htmlFor="justification">Reason for Request *</Label>
            <Select
              value={formData.justificationCategory}
              onValueChange={(value) => setFormData({ ...formData, justificationCategory: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {JUSTIFICATION_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label htmlFor="details">
              Additional Details {formData.justificationCategory === 'other' && '*'}
            </Label>
            <Textarea
              id="details"
              placeholder="Provide any additional information about your request..."
              value={formData.justificationDetails}
              onChange={(e) => setFormData({ ...formData, justificationDetails: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
