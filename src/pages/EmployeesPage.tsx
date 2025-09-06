import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, DollarSign, Lock } from 'lucide-react';
import EmployeeForm from '@/components/EmployeeForm';
import EmployeeStats from '@/components/EmployeeStats';
import EmployeeWageRates from '@/components/EmployeeWageRates';
import AdminPasswordChange from '@/components/AdminPasswordChange';
import { useAuth } from '@/hooks/useAuth';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  role: string;
  hiring_date: string;
  email?: string;
  phone_number?: string;
  morning_wage_rate?: number;
  night_wage_rate?: number;
  is_admin_user?: boolean;
}

const EmployeesPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [wageRateEmployee, setWageRateEmployee] = useState<Employee | null>(null);
  const [passwordChangeEmployee, setPasswordChangeEmployee] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

      // Fetch regular employees
      let employeeQuery = supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeOrganizationId) {
        employeeQuery = employeeQuery.eq('organization_id', activeOrganizationId);
      }

      const { data: employeeData, error: employeeError } = await employeeQuery;
      
      if (employeeError) throw employeeError;

      // Only return regular employees - don't mix admin users with employees
      return (employeeData || []).map((emp: any) => ({
        ...emp,
        is_admin_user: false
      })) as (Employee & { is_admin_user?: boolean })[];
    }
  });

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users', (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

      // Fetch admin users
      let adminQuery = supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeOrganizationId) {
        adminQuery = adminQuery.eq('organization_id', activeOrganizationId);
      }

      const { data: adminData, error: adminError } = await adminQuery;
      
      if (adminError) throw adminError;

      return adminData || [];
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      // Only allow deleting regular employees, not admin users
      if (employee.is_admin_user) {
        throw new Error('Cannot delete admin users from employee management');
      }
      
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(t('employeeDeleted'));
    },
    onError: () => {
      toast.error(t('error'));
    }
  });

  const filteredEmployees = employees?.filter(employee =>
    employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.staff_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.role.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (employee: Employee) => {
    // Don't allow editing admin users through employee form
    if (employee.is_admin_user) {
      toast.error('Admin users should be managed through the admin panel');
      return;
    }
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = (employee: Employee) => {
    // Don't allow deleting admin users
    if (employee.is_admin_user) {
      toast.error('Cannot delete admin users from employee management');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${employee.full_name}?`)) {
      deleteEmployeeMutation.mutate(employee);
    }
  };

  const handleViewStats = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleSetWageRates = (employee: Employee) => {
    setWageRateEmployee(employee);
  };

  const handleChangePassword = (employee: Employee) => {
    setPasswordChangeEmployee(employee);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('employees')}</h1>
          <p className="mt-2 text-sm text-gray-600">Manage employee records and information</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('addEmployee')}</span>
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Admin Users Section - Only visible to owners/global owners */}
      {(user?.role === 'owner' || (user as any)?.is_global_owner) && adminUsers && adminUsers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Admin Users</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminUsers.map((admin) => (
              <Card key={admin.id} className="hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {admin.full_name || admin.username}
                      </h3>
                      <p className="text-sm text-muted-foreground">{admin.username}</p>
                      <div className="flex items-center mt-2 space-x-2">
                        <Lock className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-600 capitalize">{admin.role}</span>
                        {admin.is_global_owner && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Global Owner</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChangePassword({
                          id: admin.id,
                          staff_id: admin.username,
                          full_name: admin.full_name || admin.username,
                          role: admin.role,
                          hiring_date: admin.created_at?.split('T')[0] || '',
                          is_admin_user: true
                        })}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Created:</strong> {new Date(admin.created_at).toLocaleDateString()}</p>
                    <p><strong>Last Updated:</strong> {new Date(admin.updated_at).toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4 text-gray-900">Regular Employees</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className="hover:shadow-lg transition-all duration-300 animate-fade-in card-interactive">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-fluid-lg font-semibold text-foreground break-words-enhanced">
                    {employee.full_name}
                  </h3>
                  <p className="text-fluid-sm text-muted-foreground">{employee.staff_id}</p>
                  {employee.role === 'admin' && (
                    <div className="flex items-center mt-2 space-x-2">
                      <Lock className="h-4 w-4 text-destructive" />
                      <span className="text-xs font-semibold text-destructive">Administrator Account</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(employee)}
                    title="Edit"
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {employee.role === 'admin' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChangePassword(employee)}
                      title="Change Password"
                      className="h-8 w-8 p-0"
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetWageRates(employee)}
                        title="Set Wage Rates"
                        className="h-8 w-8 p-0"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(employee)}
                        className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employee.role === 'admin' ? (
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-destructive/10 to-warning/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-fluid-sm text-destructive/80">Full system access with password management</p>
                  </div>
                  
                  <div className="space-y-2 text-fluid-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-muted-foreground">Username:</span>
                      <span className="text-foreground font-medium">{employee.staff_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-muted-foreground">{t('role')}:</span>
                      <span className="text-destructive font-semibold">{employee.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-muted-foreground">Created:</span>
                      <span className="text-foreground">{new Date(employee.hiring_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-3 rounded-lg border border-primary/20">
                      <p className="text-xs font-medium text-primary uppercase tracking-wide">Morning Rate</p>
                      <p className="text-fluid-lg font-bold text-primary">LE {employee.morning_wage_rate?.toFixed(2) || '17.00'}</p>
                      <p className="text-xs text-primary/70">per hour</p>
                    </div>
                    <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 p-3 rounded-lg border border-secondary/30">
                      <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wide">Night Rate</p>
                      <p className="text-fluid-lg font-bold text-secondary-foreground">LE {employee.night_wage_rate?.toFixed(2) || '20.00'}</p>
                      <p className="text-xs text-secondary-foreground/70">per hour</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-fluid-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-muted-foreground">{t('role')}:</span>
                      <span className="text-foreground">{employee.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-muted-foreground">{t('hiringDate')}:</span>
                      <span className="text-foreground">{new Date(employee.hiring_date).toLocaleDateString()}</span>
                    </div>
                    {employee.email && (
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">{t('email')}:</span>
                        <span className="text-foreground break-words-enhanced">{employee.email}</span>
                      </div>
                    )}
                    {employee.phone_number && (
                      <div className="flex justify-between">
                        <span className="font-medium text-muted-foreground">{t('phoneNumber')}:</span>
                        <span className="text-foreground">{employee.phone_number}</span>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full hover-scale"
                    onClick={() => handleViewStats(employee)}
                  >
                    View Statistics
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          onClose={() => {
            setShowForm(false);
            setEditingEmployee(null);
          }}
        />
      )}

      {selectedEmployee && (
        <EmployeeStats
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {wageRateEmployee && (
        <EmployeeWageRates
          employee={wageRateEmployee}
          onClose={() => setWageRateEmployee(null)}
        />
      )}

      {passwordChangeEmployee && (
        <AdminPasswordChange
          employee={passwordChangeEmployee}
          onClose={() => setPasswordChangeEmployee(null)}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
