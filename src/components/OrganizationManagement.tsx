import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building, Users, UserPlus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const OrganizationManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'employee' as 'admin' | 'employee',
    organization_id: ''
  });

  // Only admins and owners can access this component
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return null;
  }

  // Fetch organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch users based on user role
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users-with-orgs'],
    queryFn: async () => {
      let query = supabase
        .from('admin_users')
        .select(`
          *,
          organizations!admin_users_organization_id_fkey (
            name
          )
        `);

      // If user is admin (not owner), only show users from their organization
      if (user?.role === 'admin' && user?.organization_id) {
        query = query.eq('organization_id', user.organization_id);
      }
      // Owners can see all users
      
      const { data, error } = await query.order('username');
      
      if (error) throw error;
      return data;
    }
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setNewOrgName('');
      setIsCreateOrgOpen(false);
      toast.success('Organization created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create organization: ' + error.message);
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const { data, error } = await supabase
        .from('admin_users')
        .insert({
          username: userData.username,
          password_hash: userData.password, // In production, this should be hashed
          full_name: userData.full_name,
          role: userData.role,
          organization_id: userData.organization_id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-orgs'] });
      setNewUserData({
        username: '',
        password: '',
        full_name: '',
        role: 'employee',
        organization_id: ''
      });
      setIsCreateUserOpen(false);
      toast.success('User created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create user: ' + error.message);
    }
  });

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-orgs'] });
      toast.success('Organization deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete organization: ' + error.message);
    }
  });

  // Update user organization mutation
  const updateUserOrgMutation = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string, organizationId: string }) => {
      const { error } = await supabase
        .from('admin_users')
        .update({ organization_id: organizationId })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-orgs'] });
      toast.success('User organization updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update user organization: ' + error.message);
    }
  });

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    createOrgMutation.mutate(newOrgName.trim());
  };

  const handleCreateUser = () => {
    if (!newUserData.username || !newUserData.password || !newUserData.organization_id) {
      toast.error('Username, password, and organization are required');
      return;
    }
    createUserMutation.mutate(newUserData);
  };

  const handleUpdateUserOrg = (userId: string, organizationId: string) => {
    updateUserOrgMutation.mutate({ userId, organizationId });
  };

  const handleDeleteOrg = (organizationId: string) => {
    deleteOrgMutation.mutate(organizationId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Organization Management</h2>
        <div className="flex gap-2">
          <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
            <DialogTrigger asChild>
              <Button>
                <Building className="h-4 w-4 mr-2" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Enter organization name"
                  />
                </div>
                <Button 
                  onClick={handleCreateOrg} 
                  disabled={createOrgMutation.isPending}
                  className="w-full"
                >
                  {createOrgMutation.isPending ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newUserData.full_name}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newUserData.role} 
                    onValueChange={(value: 'admin' | 'employee') => setNewUserData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {user?.role === 'owner' && (
                        <SelectItem value="owner">Owner</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="organization">Organization</Label>
                  <Select 
                    value={newUserData.organization_id} 
                    onValueChange={(value) => setNewUserData(prev => ({ ...prev, organization_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleCreateUser} 
                  disabled={createUserMutation.isPending}
                  className="w-full"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="text-center py-4">Loading organizations...</div>
          ) : (
            <div className="grid gap-2">
              {organizations?.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{org.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {users?.filter(u => u.organization_id === org.id).length || 0} users
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          disabled={deleteOrgMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{org.name}"? This action cannot be undone.
                            All users assigned to this organization will have their organization assignment removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteOrg(org.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <div className="grid gap-2">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{user.full_name || user.username}</h4>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                      {user.organizations && (
                        <Badge variant="outline">
                          {user.organizations.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Select
                      value={user.organization_id || ''}
                      onValueChange={(value) => handleUpdateUserOrg(user.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations?.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationManagement;