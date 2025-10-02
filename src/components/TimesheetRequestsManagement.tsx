import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Edit, Plus, Trash2 } from 'lucide-react';
import { JUSTIFICATION_CATEGORIES } from '@/constants/timesheetRequestReasons';

export const TimesheetRequestsManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

  // Fetch pending requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['timesheet-requests', activeOrganizationId],
    queryFn: async () => {
      let query = supabase
        .from('timesheet_change_requests')
        .select('*, employees(full_name, staff_id)')
        .order('created_at', { ascending: false });

      if (activeOrganizationId) {
        query = query.eq('organization_id', activeOrganizationId);
      } else {
        query = query.is('organization_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (user.role === 'admin' || user.role === 'owner'),
  });

  const handleApprove = async (request: any) => {
    setIsProcessing(true);
    try {
      // Get admin user ID
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('username', user?.username)
        .single();

      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('timesheet_change_requests')
        .update({
          status: 'approved',
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Apply the changes based on request type
      if (request.request_type === 'edit') {
        // Update existing timesheet entry
        const { error: timesheetError } = await supabase
          .from('timesheet_entries')
          .update({
            clock_in_date: request.requested_clock_in_date,
            clock_in_time: request.requested_clock_in_time,
            clock_out_date: request.requested_clock_out_date,
            clock_out_time: request.requested_clock_out_time,
            clock_in_location: request.requested_clock_in_location,
            clock_out_location: request.requested_clock_out_location,
          })
          .eq('id', request.original_entry_id);

        if (timesheetError) throw timesheetError;
      } else if (request.request_type === 'add') {
        // Add new timesheet entry
        const { error: timesheetError } = await supabase
          .from('timesheet_entries')
          .insert({
            employee_id: request.employee_id,
            employee_name: request.employee_name,
            organization_id: request.organization_id,
            clock_in_date: request.requested_clock_in_date,
            clock_in_time: request.requested_clock_in_time,
            clock_out_date: request.requested_clock_out_date,
            clock_out_time: request.requested_clock_out_time,
            clock_in_location: request.requested_clock_in_location || 'Office',
            clock_out_location: request.requested_clock_out_location || 'Office',
          });

        if (timesheetError) throw timesheetError;
      } else if (request.request_type === 'delete') {
        // Delete timesheet entry
        const { error: timesheetError } = await supabase
          .from('timesheet_entries')
          .delete()
          .eq('id', request.original_entry_id);

        if (timesheetError) throw timesheetError;
      }

      toast.success('Request approved and changes applied!');
      queryClient.invalidateQueries({ queryKey: ['timesheet-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries'] });
      setSelectedRequest(null);
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error.message || 'Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: any) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsProcessing(true);
    try {
      // Get admin user ID
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('username', user?.username)
        .single();

      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      // Update request status
      const { error } = await supabase
        .from('timesheet_change_requests')
        .update({
          status: 'rejected',
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['timesheet-requests'] });
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'edit':
        return <Edit className="h-4 w-4" />;
      case 'add':
        return <Plus className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'edit':
        return 'Edit Entry';
      case 'add':
        return 'Add Entry';
      case 'delete':
        return 'Delete Entry';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getJustificationLabel = (category: string) => {
    const cat = JUSTIFICATION_CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const reviewedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve or reject timesheet change requests</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getRequestTypeIcon(request.request_type)}
                        <span className="font-semibold">{getRequestTypeLabel(request.request_type)}</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Employee: {request.employee_name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>

                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Reason:</span> {getJustificationLabel(request.justification_category)}</p>
                    {request.justification_details && (
                      <p className="text-muted-foreground">{request.justification_details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Requests */}
      {reviewedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reviewedRequests.slice(0, 10).map((request: any) => (
                <div key={request.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getRequestTypeIcon(request.request_type)}
                      <span>{request.employee_name}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{getRequestTypeLabel(request.request_type)}</span>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getRequestTypeIcon(selectedRequest?.request_type)}
              {getRequestTypeLabel(selectedRequest?.request_type)} Request
            </DialogTitle>
            <DialogDescription>
              Review the details and approve or reject this request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              {/* Employee Info */}
              <div className="space-y-2">
                <h4 className="font-semibold">Employee Information</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {selectedRequest.employee_name}</p>
                  <p><span className="text-muted-foreground">Submitted:</span> {format(new Date(selectedRequest.created_at), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              {/* Original Entry */}
              {(selectedRequest.request_type === 'edit' || selectedRequest.request_type === 'delete') && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Original Entry</h4>
                  <div className="p-3 bg-muted rounded text-sm space-y-1">
                    <p><span className="text-muted-foreground">Clock In:</span> {selectedRequest.original_clock_in_date} at {selectedRequest.original_clock_in_time}</p>
                    <p><span className="text-muted-foreground">Clock Out:</span> {selectedRequest.original_clock_out_date} at {selectedRequest.original_clock_out_time}</p>
                  </div>
                </div>
              )}

              {/* Requested Changes */}
              {selectedRequest.request_type !== 'delete' && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Requested Changes</h4>
                  <div className="p-3 bg-primary/5 rounded text-sm space-y-1">
                    <p><span className="text-muted-foreground">Clock In:</span> {selectedRequest.requested_clock_in_date} at {selectedRequest.requested_clock_in_time}</p>
                    <p><span className="text-muted-foreground">Clock Out:</span> {selectedRequest.requested_clock_out_date} at {selectedRequest.requested_clock_out_time}</p>
                    {selectedRequest.requested_clock_in_location && (
                      <p><span className="text-muted-foreground">Location:</span> {selectedRequest.requested_clock_in_location}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Justification */}
              <div className="space-y-2">
                <h4 className="font-semibold">Justification</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Reason:</span> {getJustificationLabel(selectedRequest.justification_category)}</p>
                  {selectedRequest.justification_details && (
                    <p className="p-3 bg-muted rounded">{selectedRequest.justification_details}</p>
                  )}
                </div>
              </div>

              {/* Rejection reason input (for pending requests) */}
              {selectedRequest.status === 'pending' && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Provide a reason if you are rejecting this request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Action Buttons */}
              {selectedRequest.status === 'pending' && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleReject(selectedRequest)}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
