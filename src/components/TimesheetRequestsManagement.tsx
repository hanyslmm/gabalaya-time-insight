import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Edit, Plus, Trash2, Calendar, CheckCheck } from 'lucide-react';
import { JUSTIFICATION_CATEGORIES } from '@/constants/timesheetRequestReasons';

export const TimesheetRequestsManagement = () => {
  console.log('TimesheetRequestsManagement component rendered');
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
      console.log('Approving request for user:', user?.username);
      console.log('Full user object:', user);
      
      // Get admin user ID - try multiple approaches
      let adminUser = null;
      
      // First try: direct lookup by username
      console.log('Looking up admin user by username:', user?.username);
      const { data: adminUserData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username')
        .eq('username', user?.username)
        .maybeSingle();

      console.log('Username lookup result:', { adminUserData, adminError });

      if (adminUserData) {
        adminUser = adminUserData;
      } else {
        // Second try: lookup by user ID
        console.log('Looking up admin user by ID:', user?.id);
        const { data: adminUserById, error: adminByIdError } = await supabase
          .from('admin_users')
          .select('id, username')
          .eq('id', user?.id)
          .maybeSingle();

        console.log('ID lookup result:', { adminUserById, adminByIdError });

        if (adminUserById) {
          adminUser = adminUserById;
        } else {
          // Third try: create admin user if doesn't exist (for development)
          console.log('Creating admin user record for:', {
            username: user?.username,
            full_name: user?.full_name || user?.username,
            role: user?.role || 'admin',
            organization_id: user?.organization_id
          });
          
          const { data: newAdminUser, error: createError } = await supabase
            .from('admin_users')
            .insert({
              username: user?.username,
              full_name: user?.full_name || user?.username,
              role: user?.role || 'admin',
              password_hash: 'temp_hash', // This will be updated later
              organization_id: user?.organization_id
            })
            .select('id, username')
            .single();

          console.log('Create admin user result:', { newAdminUser, createError });

          if (newAdminUser) {
            adminUser = newAdminUser;
          } else {
            console.error('Failed to create admin user:', createError);
            // Try a simpler approach - just use the current user ID
            console.log('Using current user as admin:', user?.id);
            adminUser = { id: user?.id, username: user?.username };
          }
        }
      }

      console.log('Admin user found/created:', adminUser);

      // Update request status - use admin user ID if available, otherwise use current user ID
      const reviewerId = adminUser?.id || user?.id;
      console.log('Using reviewer ID:', reviewerId);

      const { error: updateError } = await supabase
        .from('timesheet_change_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
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

  const handleReject = async (request: any, reason?: string) => {
    setIsProcessing(true);
    try {
      console.log('Rejecting request for user:', user?.username);
      
      // Get admin user ID - try multiple approaches
      let adminUser = null;
      
      // First try: direct lookup by username
      const { data: adminUserData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username')
        .eq('username', user?.username)
        .maybeSingle();

      if (adminUserData) {
        adminUser = adminUserData;
      } else {
        // Second try: lookup by user ID
        const { data: adminUserById, error: adminByIdError } = await supabase
          .from('admin_users')
          .select('id, username')
          .eq('id', user?.id)
          .maybeSingle();

        if (adminUserById) {
          adminUser = adminUserById;
        } else {
          // Third try: create admin user if doesn't exist (for development)
          console.log('Creating admin user record for:', user?.username);
          const { data: newAdminUser, error: createError } = await supabase
            .from('admin_users')
            .insert({
              username: user?.username,
              full_name: user?.full_name || user?.username,
              role: user?.role || 'admin',
              password_hash: 'temp_hash', // This will be updated later
              organization_id: user?.organization_id
            })
            .select('id, username')
            .single();

          if (newAdminUser) {
            adminUser = newAdminUser;
          }
        }
      }

      // Use admin user ID if available, otherwise use current user ID
      const reviewerId = adminUser?.id || user?.id;
      console.log('Using reviewer ID for reject:', reviewerId);

      // Update request status
      const { error } = await supabase
        .from('timesheet_change_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || rejectionReason || 'No reason provided',
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

  // Helper function to calculate hours difference
  const calculateHoursDifference = (request: any) => {
    console.log('Calculating hours for request:', {
      id: request.id,
      type: request.request_type,
      requested_clock_in_date: request.requested_clock_in_date,
      requested_clock_in_time: request.requested_clock_in_time,
      requested_clock_out_date: request.requested_clock_out_date,
      requested_clock_out_time: request.requested_clock_out_time,
      original_clock_in_date: request.original_clock_in_date,
      original_clock_in_time: request.original_clock_in_time,
      original_clock_out_date: request.original_clock_out_date,
      original_clock_out_time: request.original_clock_out_time
    });
    
    if (request.request_type === 'add') {
      if (request.requested_clock_in_date && request.requested_clock_in_time && 
          request.requested_clock_out_date && request.requested_clock_out_time) {
        const clockIn = new Date(`${request.requested_clock_in_date}T${request.requested_clock_in_time}`);
        const clockOut = new Date(`${request.requested_clock_out_date}T${request.requested_clock_out_time}`);
        const diffMs = clockOut.getTime() - clockIn.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        console.log('Add request hours calculated:', diffHours);
        return { hours: diffHours, type: 'add' };
      }
    } else if (request.request_type === 'edit') {
      if (request.original_clock_in_date && request.original_clock_in_time && 
          request.original_clock_out_date && request.original_clock_out_time &&
          request.requested_clock_in_date && request.requested_clock_in_time && 
          request.requested_clock_out_date && request.requested_clock_out_time) {
        const originalClockIn = new Date(`${request.original_clock_in_date}T${request.original_clock_in_time}`);
        const originalClockOut = new Date(`${request.original_clock_out_date}T${request.original_clock_out_time}`);
        const newClockIn = new Date(`${request.requested_clock_in_date}T${request.requested_clock_in_time}`);
        const newClockOut = new Date(`${request.requested_clock_out_date}T${request.requested_clock_out_time}`);
        
        const originalHours = (originalClockOut.getTime() - originalClockIn.getTime()) / (1000 * 60 * 60);
        const newHours = (newClockOut.getTime() - newClockIn.getTime()) / (1000 * 60 * 60);
        const diffHours = newHours - originalHours;
        
        return { hours: Math.abs(diffHours), type: diffHours >= 0 ? 'increase' : 'decrease' };
      }
    } else if (request.request_type === 'delete') {
      if (request.original_clock_in_date && request.original_clock_in_time && 
          request.original_clock_out_date && request.original_clock_out_time) {
        const clockIn = new Date(`${request.original_clock_in_date}T${request.original_clock_in_time}`);
        const clockOut = new Date(`${request.original_clock_out_date}T${request.original_clock_out_time}`);
        const diffMs = clockOut.getTime() - clockIn.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return { hours: diffHours, type: 'remove' };
      }
    }
    return null;
  };

  // Approve all pending requests mutation
  const approveAllMutation = useMutation({
    mutationFn: async (pendingRequests: any[]) => {
      console.log('Approve all requests for user:', user?.username);
      
      // Get admin user ID - try multiple approaches
      let adminUser = null;
      
      // First try: direct lookup by username
      const { data: adminUserData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username')
        .eq('username', user?.username)
        .maybeSingle();

      if (adminUserData) {
        adminUser = adminUserData;
      } else {
        // Second try: lookup by user ID
        const { data: adminUserById, error: adminByIdError } = await supabase
          .from('admin_users')
          .select('id, username')
          .eq('id', user?.id)
          .maybeSingle();

        if (adminUserById) {
          adminUser = adminUserById;
        } else {
          // Third try: create admin user if doesn't exist (for development)
          console.log('Creating admin user record for:', user?.username);
          const { data: newAdminUser, error: createError } = await supabase
            .from('admin_users')
            .insert({
              username: user?.username,
              full_name: user?.full_name || user?.username,
              role: user?.role || 'admin',
              password_hash: 'temp_hash', // This will be updated later
              organization_id: user?.organization_id
            })
            .select('id, username')
            .single();

          if (newAdminUser) {
            adminUser = newAdminUser;
          }
        }
      }

      // Use admin user ID if available, otherwise use current user ID
      const reviewerId = adminUser?.id || user?.id;
      console.log('Using reviewer ID for approve all:', reviewerId);

      const results = [];
      for (const request of pendingRequests) {
        try {
          // Update request status
          await supabase
            .from('timesheet_change_requests')
            .update({
              status: 'approved',
              reviewed_by: reviewerId,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', request.id);

          // Apply the changes based on request type
          if (request.request_type === 'edit') {
            await supabase
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
          } else if (request.request_type === 'add') {
            await supabase
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
          } else if (request.request_type === 'delete') {
            await supabase
              .from('timesheet_entries')
              .delete()
              .eq('id', request.original_entry_id);
          }
          
          results.push({ id: request.id, success: true });
        } catch (error) {
          results.push({ id: request.id, success: false, error });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (failureCount === 0) {
        toast.success(`All ${successCount} requests approved successfully!`);
      } else {
        toast.success(`${successCount} requests approved, ${failureCount} failed`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['timesheet-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries'] });
    },
    onError: (error: any) => {
      console.error('Error approving all requests:', error);
      toast.error('Failed to approve requests: ' + (error.message || 'Unknown error'));
    }
  });

  // Quick reject mutation
  const quickRejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      console.log('Quick rejecting request for user:', user?.username);
      
      // Get admin user ID - try multiple approaches
      let adminUser = null;
      
      // First try: direct lookup by username
      const { data: adminUserData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username')
        .eq('username', user?.username)
        .maybeSingle();

      if (adminUserData) {
        adminUser = adminUserData;
      } else {
        // Second try: lookup by user ID
        const { data: adminUserById, error: adminByIdError } = await supabase
          .from('admin_users')
          .select('id, username')
          .eq('id', user?.id)
          .maybeSingle();

        if (adminUserById) {
          adminUser = adminUserById;
        } else {
          // Third try: create admin user if doesn't exist (for development)
          console.log('Creating admin user record for:', user?.username);
          const { data: newAdminUser, error: createError } = await supabase
            .from('admin_users')
            .insert({
              username: user?.username,
              full_name: user?.full_name || user?.username,
              role: user?.role || 'admin',
              password_hash: 'temp_hash', // This will be updated later
              organization_id: user?.organization_id
            })
            .select('id, username')
            .single();

          if (newAdminUser) {
            adminUser = newAdminUser;
          }
        }
      }

      // Use admin user ID if available, otherwise use current user ID
      const reviewerId = adminUser?.id || user?.id;
      console.log('Using reviewer ID for quick reject:', reviewerId);

      const { error } = await supabase
        .from('timesheet_change_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || 'No reason provided',
        })
        .eq('id', requestId);

      if (error) throw error;
      return requestId;
    },
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['timesheet-requests'] });
    },
    onError: (error: any) => {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request: ' + (error.message || 'Unknown error'));
    }
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const reviewedRequests = requests?.filter(r => r.status !== 'pending') || [];
  
  console.log('Requests data:', { requests, pendingRequests: pendingRequests.length, reviewedRequests: reviewedRequests.length });

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve or reject timesheet change requests</CardDescription>
            </div>
            {pendingRequests.length > 0 && (
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                disabled={approveAllMutation.isPending}
                onClick={() => {
                  if (confirm(`Are you sure you want to approve all ${pendingRequests.length} pending requests?`)) {
                    approveAllMutation.mutate(pendingRequests);
                  }
                }}
              >
                {approveAllMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Approve All
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request: any) => {
                const hoursInfo = calculateHoursDifference(request);
                console.log('Request hours calculation:', { request: request.id, hoursInfo, requestType: request.request_type });
                return (
                <div
                  key={request.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {getRequestTypeIcon(request.request_type)}
                        <span className="font-semibold">{getRequestTypeLabel(request.request_type)}</span>
                        {getStatusBadge(request.status)}
                      </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Employee: <span className="font-medium">{request.employee_name}</span></span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(request.created_at), 'MMM dd, HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hours Summary */}
                      {hoursInfo && (
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            hoursInfo.type === 'add' || hoursInfo.type === 'increase' ? 'text-green-600' :
                            hoursInfo.type === 'remove' || hoursInfo.type === 'decrease' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {hoursInfo.type === 'add' && '+'}
                            {hoursInfo.type === 'remove' && '-'}
                            {hoursInfo.type === 'increase' && '+'}
                            {hoursInfo.type === 'decrease' && '-'}
                            {hoursInfo.hours.toFixed(1)}h
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {hoursInfo.type === 'add' && 'New entry'}
                            {hoursInfo.type === 'remove' && 'Will remove'}
                            {hoursInfo.type === 'increase' && 'More hours'}
                            {hoursInfo.type === 'decrease' && 'Fewer hours'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Request Details Summary */}
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Date:</span>
                        <span>
                          {request.request_type === 'add' && request.requested_clock_in_date && (
                            format(new Date(request.requested_clock_in_date), 'MMM dd, yyyy')
                          )}
                          {request.request_type === 'edit' && request.original_clock_in_date && (
                            format(new Date(request.original_clock_in_date), 'MMM dd, yyyy')
                          )}
                          {request.request_type === 'delete' && request.original_clock_in_date && (
                            format(new Date(request.original_clock_in_date), 'MMM dd, yyyy')
                          )}
                    </span>
                  </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Reason:</span>
                        <span>{getJustificationLabel(request.justification_category)}</span>
                      </div>
                    {request.justification_details && (
                        <p className="text-muted-foreground text-xs">{request.justification_details}</p>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRequest(request)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        View Details
                      </Button>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          disabled={quickRejectMutation.isPending}
                          onClick={() => {
                            const reason = prompt('Rejection reason (optional):');
                            quickRejectMutation.mutate({ requestId: request.id, reason });
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Quick Reject
                        </Button>

                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(request)}
                          disabled={isProcessing}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  <Label htmlFor="rejection-reason">Rejection Reason (Optional)</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Provide a reason if you are rejecting this request (optional)..."
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
