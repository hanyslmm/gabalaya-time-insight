import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  is_default: boolean;
}

const RoleManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['employee-roles', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('employee_roles')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as Role[];
    }
  });
  const [newRoleName, setNewRoleName] = useState('');
  
  const addRoleMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      
      try {
        // Try to insert the new role directly
        const { error } = await (supabase as any)
          .from('employee_roles')
          .insert({ name: trimmed, is_default: false, organization_id: activeOrganizationId });
        
        if (error) {
          // Check if it's a unique constraint violation
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
            throw new Error('Role already exists');
          }
          throw error;
        }
      } catch (err: any) {
        // Handle any other errors
        if (err.message === 'Role already exists') {
          throw err;
        }
        throw new Error(err?.message || 'Failed to add role');
      }
    },
    onSuccess: () => {
      setNewRoleName('');
      queryClient.invalidateQueries({ queryKey: ['employee-roles', activeOrganizationId] });
      toast.success('Role added successfully');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to add role')
  });

  const handleAddRole = () => {
    if (!newRoleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    addRoleMutation.mutate(newRoleName);
  };

  const handleDeleteRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    if (role?.is_default) {
      toast.error('Cannot delete default roles');
      return;
    }
    (async () => {
      const { error } = await (supabase as any)
        .from('employee_roles')
        .delete()
        .eq('id', roleId)
        .eq('organization_id', activeOrganizationId);
      if (error) {
        toast.error('Failed to delete role');
      } else {
        queryClient.invalidateQueries({ queryKey: ['employee-roles', activeOrganizationId] });
        toast.success('Role deleted successfully');
      }
    })();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Roles Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(roles || []).map((role) => (
            <div key={role.id} className="flex items-center gap-2">
              <Badge variant={role.is_default ? "default" : "secondary"}>
                {role.name}
              </Badge>
              {!role.is_default && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRole(role.id)}
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-role">Add New Role</Label>
            <Input
              id="new-role"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Enter role name"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAddRole} size="sm" disabled={!activeOrganizationId || addRoleMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleManagement;