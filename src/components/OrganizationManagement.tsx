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
import { Plus, Building, Users, UserPlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const OrganizationManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [onlyUnassigned, setOnlyUnassigned] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'employee' as 'admin' | 'employee',
    organization_id: ''
  });

  // Only owners and admins can access this component
  // Admins can manage their own organization (RLS policies enforce org-scoping)
  if (!user || !['owner', 'admin'].includes(user.role)) {
    return null;
  }

  // Check if user is owner for certain operations
  const isOwner = user.role === 'owner';

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

  // Fetch users from employees table instead of admin_users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['employees-for-orgs'],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select(`
          id,
          full_name,
          staff_id,
          role,
          organization_id,
          organizations!employees_organization_id_fkey (
            name
          )
        `);

      // If user is admin (not owner), only show employees from their organization
      if (user?.role === 'admin' && user?.organization_id) {
        query = query.eq('organization_id', user.organization_id);
      }
      // Owners can see all employees
      
      const { data, error } = await query.order('full_name');
      
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

  // Create employee mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          staff_id: userData.username,
          full_name: userData.full_name,
          role: userData.role,
          organization_id: userData.organization_id,
          hiring_date: new Date().toISOString().split('T')[0] // Today's date
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-for-orgs'] });
      setNewUserData({
        username: '',
        password: '',
        full_name: '',
        role: 'employee',
        organization_id: ''
      });
      setIsCreateUserOpen(false);
      toast.success('Employee created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create employee: ' + error.message);
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
      queryClient.invalidateQueries({ queryKey: ['employees-for-orgs'] });
      toast.success('Organization deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete organization: ' + error.message);
    }
  });

  // Update employee organization mutation
  const updateUserOrgMutation = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string, organizationId: string | null }) => {
      const { error } = await supabase
        .from('employees')
        .update({ organization_id: organizationId })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-for-orgs'] });
      toast.success('Employee organization updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update employee organization: ' + error.message);
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
    if (!newUserData.username || !newUserData.full_name || !newUserData.organization_id) {
      toast.error('Staff ID, full name, and organization are required');
      return;
    }
    createUserMutation.mutate(newUserData);
  };

  const handleUpdateUserOrg = (userId: string, organizationId: string) => {
    const value = organizationId === 'none' ? null : organizationId;
    updateUserOrgMutation.mutate({ userId, organizationId: value });
  };

  const handleDeleteOrg = (organizationId: string) => {
    deleteOrgMutation.mutate(organizationId);
  };

  // Pagination logic
  const ITEMS_PER_PAGE = 15;
  // Build filtered list
  const rolesList = Array.from(new Set((users || []).map((u: any) => u.role))).sort();
  const effectiveOrgFilter = onlyUnassigned ? 'none' : filterOrgId;
  const filteredEmployees = (users || []).filter((emp: any) => {
    const matchesSearch = searchTerm.trim().length === 0 ||
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.staff_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = effectiveOrgFilter === 'all'
      ? true
      : (effectiveOrgFilter === 'none' ? !emp.organization_id : emp.organization_id === effectiveOrgFilter);
    const matchesRole = filterRole === 'all' ? true : (emp.role === filterRole);
    return matchesSearch && matchesOrg && matchesRole;
  });
  const totalEmployees = filteredEmployees.length || 0;
  const totalPages = Math.ceil(totalEmployees / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex) || [];

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Reset to page 1 when users data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [users?.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Organization Management</h2>
        <div className="flex gap-2">
          {/* Only owners can create new organizations */}
          {isOwner && (
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
          )}

          <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                New Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Staff ID</Label>
                  <Input
                    id="username"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter staff ID"
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
                  {createUserMutation.isPending ? 'Creating...' : 'Create Employee'}
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
                      {users?.filter(emp => emp.organization_id === org.id).length || 0} employees
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

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees
            </div>
            <div className="text-sm text-muted-foreground">
              {totalEmployees > 0 && (
                <>Showing {startIndex + 1}-{Math.min(endIndex, totalEmployees)} of {totalEmployees}</>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label htmlFor="searchEmp">Search</Label>
              <Input id="searchEmp" placeholder="Search by name or ID" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div>
              <Label>Organization</Label>
              <Select value={filterOrgId} onValueChange={setFilterOrgId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {rolesList.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quick Filter</Label>
              <div className="flex items-center gap-2 mt-2">
                <input id="onlyUnassigned" type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                <Label htmlFor="onlyUnassigned">Only unassigned</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setFilterOrgId('all'); setFilterRole('all'); setOnlyUnassigned(false); }}>Reset Filters</Button>
          </div>
          {usersLoading ? (
            <div className="text-center py-4">Loading employees...</div>
          ) : (
            <div className="grid gap-2">
              {paginatedEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{employee.full_name}</h4>
                    <p className="text-sm text-muted-foreground">ID: {employee.staff_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={employee.role === 'admin' ? 'default' : 'secondary'}>
                        {employee.role}
                      </Badge>
                      <Badge variant="outline">
                        {employee.organizations?.name || 'No Organization'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Select
                      value={employee.organization_id ?? 'none'}
                      onValueChange={(value) => handleUpdateUserOrg(employee.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Organization</SelectItem>
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationManagement;