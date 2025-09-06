import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AdminRoleChangeProps {
  adminUser: {
    id: string;
    username: string;
    full_name?: string;
    role: string;
    is_global_owner?: boolean;
  };
  onClose: () => void;
}

const AdminRoleChange: React.FC<AdminRoleChangeProps> = ({ adminUser, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(adminUser.role);
  const [isGlobalOwner, setIsGlobalOwner] = useState(adminUser.is_global_owner || false);

  // Define available roles
  const availableRoles = [
    { value: 'admin', label: 'Admin' },
    { value: 'owner', label: 'Owner' },
  ];

  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        role: selectedRole,
        is_global_owner: isGlobalOwner,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('id', adminUser.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User role updated successfully');
      onClose();
    },
    onError: (error: any) => {
      console.error('Role update error:', error);
      toast.error(error.message || 'Failed to update user role');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent users from removing their own owner status
    if (adminUser.username === user?.username && selectedRole !== 'owner' && !isGlobalOwner) {
      toast.error('You cannot remove your own owner privileges');
      return;
    }

    updateRoleMutation.mutate();
  };

  // Only allow global owners or owners to change roles
  const canChangeRoles = (user as any)?.is_global_owner || user?.role === 'owner';

  if (!canChangeRoles) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              You don't have permission to change user roles.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>User:</strong> {adminUser.full_name || adminUser.username}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Username:</strong> {adminUser.username}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Only global owners can set other users as global owners */}
          {(user as any)?.is_global_owner && (
            <div className="space-y-2">
              <Label>Global Owner Status</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="globalOwner"
                  checked={isGlobalOwner}
                  onChange={(e) => setIsGlobalOwner(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="globalOwner" className="text-sm">
                  Grant global owner privileges (can access all organizations)
                </Label>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminRoleChange;