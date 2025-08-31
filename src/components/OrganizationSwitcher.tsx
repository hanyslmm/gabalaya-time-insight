import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building } from 'lucide-react';
import { toast } from 'sonner';

const OrganizationSwitcher: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Only show for owners
  if (!user || user.role !== 'owner') {
    return null;
  }

  // Fetch organizations based on user role
  const { data: organizations, isLoading } = useQuery({
    queryKey: ['available-organizations', user.id],
    queryFn: async () => {
      // Owners can see all organizations
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Get current organization info
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-org', user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Get organization names separately
  const { data: currentOrgData } = useQuery({
    queryKey: ['current-org-name', (currentUser as any)?.current_organization_id || currentUser?.organization_id],
    queryFn: async () => {
      const orgId = (currentUser as any)?.current_organization_id || currentUser?.organization_id;
      if (!orgId) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!((currentUser as any)?.current_organization_id || currentUser?.organization_id)
  });

  // Switch organization mutation
  const switchOrgMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const { data, error } = await supabase.functions.invoke('switch-organization', {
        body: { organizationId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update local user state and refresh queries
      queryClient.invalidateQueries({ queryKey: ['current-user-org'] });
      toast.success('Organization switched successfully');
      
      // Refresh the page to update all data
      window.location.reload();
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

  const getCurrentOrganizationId = () => {
    return (currentUser as any)?.current_organization_id || currentUser?.organization_id;
  };

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

  // Owners always get the full switcher interface

  return (
    <Select
      value={getCurrentOrganizationId() || ''}
      onValueChange={handleOrganizationSwitch}
      disabled={switchOrgMutation.isPending}
    >
      <SelectTrigger asChild>
        <Button variant="ghost" size="sm" className="w-auto min-w-fit max-w-48">
          <Building className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="text-sm truncate">
            {switchOrgMutation.isPending ? 'Switching...' : getCurrentOrganizationName()}
          </span>
        </Button>
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