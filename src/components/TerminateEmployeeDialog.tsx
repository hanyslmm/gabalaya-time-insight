import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, Calendar } from 'lucide-react';
import { TERMINATION_REASONS } from '@/constants/terminationReasons';

interface TerminateEmployeeDialogProps {
  employee: {
    id: string;
    full_name: string;
    staff_id: string;
    organization_id: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TerminateEmployeeDialog: React.FC<TerminateEmployeeDialogProps> = ({
  employee,
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [terminationReason, setTerminationReason] = useState('');
  const [eligibleForRehire, setEligibleForRehire] = useState<string>('true');
  const [terminationNotes, setTerminationNotes] = useState('');

  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error('No employee selected');

      console.log('🔄 Terminating employee:', {
        id: employee.id,
        name: employee.full_name,
        currentOrgId: employee.organization_id,
      });

      const updateData = {
        status: 'terminated',
        termination_date: terminationDate,
        termination_reason: terminationReason,
        eligible_for_rehire: eligibleForRehire === 'true',
        termination_notes: terminationNotes || null,
        last_organization_id: employee.organization_id,
        organization_id: null, // Remove from current organization
      };

      console.log('📝 Update data:', updateData);

      const { data, error, count } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', employee.id)
        .select('*');

      console.log('🔍 Update response:', { data, error, count });

      if (error) {
        console.error('❌ Termination error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Update returned no data - this might be normal if organization_id was set to null');
      }

      // Verify the update by fetching the employee directly
      const { data: verifyData, error: verifyError } = await supabase
        .from('employees')
        .select('id, status, organization_id, termination_date')
        .eq('id', employee.id)
        .maybeSingle() as any;

      console.log('🔍 Verification query result:', { verifyData, verifyError });

      if (verifyData) {
        console.log('✅ Employee status after update:', {
          status: verifyData?.status,
          organization_id: verifyData?.organization_id,
          termination_date: verifyData?.termination_date
        });
      }
    },
    onSuccess: () => {
      // Invalidate ALL employee-related queries to force a complete refresh
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['employees'] });
      
      toast.success(t('Employee terminated successfully'));
      handleClose();
    },
    onError: (error) => {
      console.error('Error terminating employee:', error);
      toast.error(t('Failed to terminate employee'));
    },
  });

  const handleClose = () => {
    setTerminationDate(new Date().toISOString().split('T')[0]);
    setTerminationReason('');
    setEligibleForRehire('true');
    setTerminationNotes('');
    onOpenChange(false);
  };

  const handleTerminate = () => {
    if (!terminationReason) {
      toast.error('Please select a termination reason');
      return;
    }
    terminateMutation.mutate();
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Terminate Employee</DialogTitle>
              <DialogDescription className="text-sm">
                {employee.full_name} (ID: {employee.staff_id})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Termination Date */}
          <div className="space-y-2">
            <Label htmlFor="termination-date" className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Termination Date *
              </div>
            </Label>
            <input
              id="termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Termination Reason */}
          <div className="space-y-2">
            <Label htmlFor="termination-reason" className="text-sm font-medium">
              Reason for Termination *
            </Label>
            <Select value={terminationReason} onValueChange={setTerminationReason}>
              <SelectTrigger id="termination-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {TERMINATION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Eligible for Rehire */}
          <div className="space-y-2">
            <Label htmlFor="eligible-rehire" className="text-sm font-medium">
              Eligible for Rehire? *
            </Label>
            <Select value={eligibleForRehire} onValueChange={setEligibleForRehire}>
              <SelectTrigger id="eligible-rehire">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes - Eligible for rehire</SelectItem>
                <SelectItem value="false">No - Not eligible for rehire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="termination-notes" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="termination-notes"
              placeholder="Add any additional context or notes about this termination..."
              value={terminationNotes}
              onChange={(e) => setTerminationNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Warning Message */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> This employee will be moved to the 
              "Terminated Employees" section and removed from active staff. Their historical 
              timesheet data will be preserved.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={terminateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleTerminate}
            disabled={terminateMutation.isPending || !terminationReason}
          >
            {terminateMutation.isPending ? 'Terminating...' : 'Terminate Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TerminateEmployeeDialog;

