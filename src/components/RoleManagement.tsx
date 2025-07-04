import React, { useState, useEffect } from 'react';
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
  const [roles, setRoles] = useState<Role[]>([
    { id: '1', name: 'Champion', is_default: true },
    { id: '2', name: 'Barista', is_default: true },
    { id: '3', name: 'Host', is_default: true }
  ]);
  const [newRoleName, setNewRoleName] = useState('');

  // Load roles from localStorage
  useEffect(() => {
    const savedRoles = localStorage.getItem('employee-roles');
    if (savedRoles) {
      setRoles(JSON.parse(savedRoles));
    }
  }, []);

  // Save roles to localStorage
  const saveRoles = (updatedRoles: Role[]) => {
    setRoles(updatedRoles);
    localStorage.setItem('employee-roles', JSON.stringify(updatedRoles));
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (roles.some(role => role.name.toLowerCase() === newRoleName.toLowerCase())) {
      toast.error('Role already exists');
      return;
    }

    const newRole: Role = {
      id: Date.now().toString(),
      name: newRoleName.trim(),
      is_default: false
    };

    saveRoles([...roles, newRole]);
    setNewRoleName('');
    toast.success('Role added successfully');
  };

  const handleDeleteRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.is_default) {
      toast.error('Cannot delete default roles');
      return;
    }

    const updatedRoles = roles.filter(r => r.id !== roleId);
    saveRoles(updatedRoles);
    toast.success('Role deleted successfully');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Roles Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
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
            <Button onClick={handleAddRole} size="sm">
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