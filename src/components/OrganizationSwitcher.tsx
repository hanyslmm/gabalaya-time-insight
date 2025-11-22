

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building } from 'lucide-react';
import { toast } from 'sonner';

const OrganizationSwitcher: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // Show for all authenticated users
  if (!user) {
    return null;
  }

  // Debug logging to see what data we have
  console.log('OrganizationSwitcher - User object:', user);
  console.log('OrganizationSwitcher - organization_id:', user.organization_id);
  console.log('OrganizationSwitcher - current_organization_id:', (user as any).current_organization_id);

  // Fetch organizations based on user role
  const { data: organizations, isLoading } = useQuery({
    queryKey: ['available-organizations', user.id],
    queryFn: async () => {
      if (user.role === 'owner' || user.is_global_owner) {
        // Owners and global owners can see all organizations
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .order('name');
        
        if (error) throw error;
        return data;
      } else {
        // Admins and employees can only see their organization
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', user.organization_id)
          .order('name');
        
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user
  });

  // Resolve current org id directly from authenticated user (works for employees and admins)
  const resolveCurrentOrgId = () => {
    return (user as any)?.current_organization_id || user?.organization_id || null;
  };

  // Get organization names separately
  const { data: currentOrgData } = useQuery({
    queryKey: ['current-org-name', resolveCurrentOrgId()],
    queryFn: async () => {
      const orgId = resolveCurrentOrgId();
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!resolveCurrentOrgId()
  });

  // Switch organization mutation
  const switchOrgMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      console.log('Attempting to switch to organization:', organizationId);
      
      try {
        const token = localStorage.getItem('auth_token');
        console.log('Token exists:', !!token);
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('Making request to switch-organization function...');
        const { data, error } = await supabase.functions.invoke('switch-organization', {
          body: { organizationId, token }
        });
        
        console.log('Switch org response - data:', data);
        console.log('Switch org response - error:', error);
        console.log('Switch org response - error type:', typeof error);
        console.log('Switch org response - error details:', error ? JSON.stringify(error) : 'no error');
        
        if (error) {
          console.error('Supabase function error:', error);
          throw error;
        }
        if (!data?.success) {
          throw new Error(data?.error || 'Failed to switch organization');
        }
        return data;
      } catch (err) {
        console.error('Switch org error details:', err);
        console.error('Error type:', typeof err);
        console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    onSuccess: async (data) => {
      // Refresh user data first to get updated organization info
      await refreshUser();
      
      // Then invalidate and refetch all organization-dependent queries
      // Use broad invalidation to catch all variations
      queryClient.invalidateQueries({ queryKey: ['current-org-name'] });
      queryClient.invalidateQueries({ queryKey: ['available-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }); // Invalidates all dashboard-data queries
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] }); // Invalidates all dashboard-charts queries
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      
      toast.success('Organization switched successfully');
      
      // Force a page refresh to ensure all data updates properly
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error) => {
      toast.error('Failed to switch organization: ' + error.message);
    }
  });

  const handleOrganizationSwitch = (organizationId: string) => {
    if (organizationId !== getCurrentOrganizationId()) {
      switchOrgMutation.mutate(organizationId);
    }
  };

  const getCurrentOrganizationId = () => resolveCurrentOrgId();

  const getCurrentOrganizationName = () => {
    return currentOrgData?.name || 'No Organization';
  };

  if (isLoading || !organizations) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Building className="h-4 w-4" />
      </Button>
    );
  }

  // For non-owners and non-global-owners, show current org name only (non-interactive)
  if (user.role !== 'owner' && !user.is_global_owner) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
        <Building className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {getCurrentOrganizationName()}
        </span>
      </div>
    );
  }

  // Owners and global owners get the full switcher interface

  return (
    <Select
      value={getCurrentOrganizationId() || ''}
      onValueChange={handleOrganizationSwitch}
      disabled={switchOrgMutation.isPending}
    >
      <SelectTrigger className="w-auto min-w-fit max-w-48 bg-transparent border-none shadow-none hover:bg-accent">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm truncate">
            {switchOrgMutation.isPending ? 'Switching...' : getCurrentOrganizationName()}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent align="end" className="w-64">
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span>{org.name}</span>
              {getCurrentOrganizationId() === org.id && (
                <span className="text-xs text-muted-foreground">(Current)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default OrganizationSwitcher;