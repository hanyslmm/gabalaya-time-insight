import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, FileText, Eye, RefreshCw, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import MobilePageWrapper, { MobileCard } from '@/components/MobilePageWrapper';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface TimesheetRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  organization_id: string;
  request_type: 'edit' | 'add' | 'delete';
  status: 'pending' | 'approved' | 'rejected';
  original_entry_id?: string;
  original_clock_in_date?: string;
  original_clock_in_time?: string;
  original_clock_out_date?: string;
  original_clock_out_time?: string;
  requested_clock_in_date?: string;
  requested_clock_in_time?: string;
  requested_clock_out_date?: string;
  requested_clock_out_time?: string;
  requested_clock_in_location?: string;
  requested_clock_out_location?: string;
  justification_category: string;
  justification_details?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

interface TimesheetRequestsListProps {
  onRefresh?: () => void;
}

export const TimesheetRequestsList: React.FC<TimesheetRequestsListProps> = ({ onRefresh }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['timesheet-change-requests', user?.username],
    queryFn: async () => {
      if (!user?.username) return [];

      // Get employee record to find the employee_id
      const { data: employee } = await supabase
        .from('employees')
        .select('id, full_name, organization_id')
        .eq('staff_id', user.username)
        .maybeSingle();

      if (!employee) return [];

      // Fetch requests for this employee
      const { data, error } = await supabase
        .from('timesheet_change_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching timesheet requests:', error);
        return [];
      }

      return data as TimesheetRequest[];
    },
    enabled: !!user?.username
  });

  // Mutation to cancel/delete a pending request
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('timesheet_change_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      return requestId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-change-requests'] });
      toast.success('Request cancelled successfully');
    },
    onError: (error: any) => {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request: ' + (error.message || 'Unknown error'));
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'add':
        return 'Add Entry';
      case 'edit':
        return 'Edit Entry';
      case 'delete':
        return 'Delete Entry';
      default:
        return type;
    }
  };

  const formatRequestDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatTimeDisplay = (date?: string, time?: string) => {
    if (!date || !time) return '—';
    try {
      const dateTime = new Date(`${date}T${time}`);
      return format(dateTime, 'MMM dd, HH:mm');
    } catch {
      return `${date} ${time}`;
    }
  };

  if (isLoading) {
    return (
      <MobileCard className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            My Timesheet Requests
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </MobileCard>
    );
  }

  return (
    <MobileCard className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
          <FileText className="h-4 w-4" />
          My Timesheet Requests
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              refetch();
              onRefresh?.();
            }}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests && requests.length > 0 ? (
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="border rounded p-2 sm:p-3 space-y-2">
                {/* Header with type and status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium">
                      {getRequestTypeLabel(request.request_type)}
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatRequestDate(request.created_at)}
                    </span>
                    {request.status === 'pending' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={cancelRequestMutation.isPending}
                            title="Cancel request"
                          >
                            {cancelRequestMutation.isPending ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Timesheet Request</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel this {getRequestTypeLabel(request.request_type).toLowerCase()} request? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Request</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelRequestMutation.mutate(request.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Cancel Request
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Request details */}
                <div className="text-xs sm:text-sm space-y-1">
                  {request.request_type === 'add' && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {formatTimeDisplay(request.requested_clock_in_date, request.requested_clock_in_time)} - 
                        {formatTimeDisplay(request.requested_clock_out_date, request.requested_clock_out_time)}
                      </span>
                    </div>
                  )}

                  {request.request_type === 'edit' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">From:</span>
                        <span>
                          {formatTimeDisplay(request.original_clock_in_date, request.original_clock_in_time)} - 
                          {formatTimeDisplay(request.original_clock_out_date, request.original_clock_out_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">To:</span>
                        <span>
                          {formatTimeDisplay(request.requested_clock_in_date, request.requested_clock_in_time)} - 
                          {formatTimeDisplay(request.requested_clock_out_date, request.requested_clock_out_time)}
                        </span>
                      </div>
                    </div>
                  )}

                  {request.request_type === 'delete' && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {formatTimeDisplay(request.original_clock_in_date, request.original_clock_in_time)} - 
                        {formatTimeDisplay(request.original_clock_out_date, request.original_clock_out_time)}
                      </span>
                    </div>
                  )}

                  {/* Justification */}
                  <div className="flex items-start gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Reason: </span>
                      <span className="font-medium">{request.justification_category}</span>
                      {request.justification_details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {request.justification_details}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin response */}
                  {request.status === 'rejected' && request.rejection_reason && (
                    <div className="flex items-start gap-2">
                      <Eye className="h-3 w-3 text-red-500 mt-0.5" />
                      <div>
                        <span className="text-red-600 font-medium">Rejection Reason: </span>
                        <span className="text-red-600">{request.rejection_reason}</span>
                      </div>
                    </div>
                  )}

                  {request.reviewed_at && (
                    <div className="text-xs text-muted-foreground">
                      Reviewed on {formatRequestDate(request.reviewed_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">No timesheet requests found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Submit a request using the "Request Add" button above
            </p>
          </div>
        )}
      </CardContent>
    </MobileCard>
  );
};
