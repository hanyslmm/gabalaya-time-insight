import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, DollarSign, Lock, UserX } from 'lucide-react';
import EmployeeForm from '@/components/EmployeeForm';
import EmployeeStats from '@/components/EmployeeStats';
import EmployeeWageRates from '@/components/EmployeeWageRates';
import AdminPasswordChange from '@/components/AdminPasswordChange';
import AdminRoleChange from '@/components/AdminRoleChange';
import TerminateEmployeeDialog from '@/components/TerminateEmployeeDialog';
import { useAuth } from '@/hooks/useAuth';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  role: string;
  hiring_date: string;
  organization_id: string;
  email?: string;
  phone_number?: string;
  morning_wage_rate?: number;
  night_wage_rate?: number;
  is_admin_user?: boolean;
  // Employee lifecycle fields
  status?: string;
  termination_date?: string;
  termination_reason?: string;
  eligible_for_rehire?: boolean;
  termination_notes?: string;
  last_organization_id?: string;
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
  const [roleChangeAdmin, setRoleChangeAdmin] = useState<any>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);

  const { data: employees, isLoading, error: employeesError } = useQuery({
    queryKey: ['employees', (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

      console.log('🔍 EmployeesPage QUERY START');
      console.log('🔍 User object:', user);
      console.log('🔍 Active Organization ID:', activeOrganizationId);

      // Fetch only active employees
      let employeeQuery = supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (activeOrganizationId) {
        employeeQuery = employeeQuery.eq('organization_id', activeOrganizationId);
      }

      console.log('🔍 About to execute query with filters:', {
        status: 'active',
        organization_id: activeOrganizationId
      });

      const { data: employeeData, error: employeeError } = await employeeQuery;
      
      console.log('🔍 Query completed!');
      console.log('🔍 Error:', employeeError);
      console.log('🔍 Data count:', employeeData?.length);
      console.log('🔍 Raw data:', employeeData);
      
      if (employeeError) {
        console.error('❌ EmployeesPage: Error fetching employees:', employeeError);
        throw employeeError;
      }

      if (!employeeData || employeeData.length === 0) {
        console.warn('⚠️ NO EMPLOYEES RETURNED FROM QUERY!');
      }

      // Only return regular employees - don't mix admin users with employees
      const result = (employeeData || []).map((emp: any) => ({
        ...emp,
        is_admin_user: false
      })) as (Employee & { is_admin_user?: boolean })[];
      
      console.log('🔍 Final result to return:', result);
      return result;
    }
  });

  // Debug log when employees data changes
  console.log('🔍 EMPLOYEES STATE:', { 
    employees, 
    count: employees?.length, 
    isLoading, 
    error: employeesError 
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
      // Allow deleting both regular employees and admin users
      if (employee.is_admin_user) {
        const { error } = await supabase
          .from('admin_users')
          .delete()
          .eq('id', employee.id);
        if (error) throw error;
        return;
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

  // Unified list: regular employees + admin users in a single view
  const unifiedEmployees: Employee[] = useMemo(() => {
    const regular = (employees || []) as Employee[];
    const adminsProjected: Employee[] = (adminUsers || []).map((admin: any) => ({
      id: admin.id,
      staff_id: admin.username,
      full_name: admin.full_name || admin.username,
      role: admin.role,
      hiring_date: admin.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      email: undefined,
      phone_number: undefined,
      morning_wage_rate: undefined,
      night_wage_rate: undefined,
      is_admin_user: true
    }));
    return [...regular, ...adminsProjected];
  }, [employees, adminUsers]);

  const filteredEmployees = unifiedEmployees?.filter(employee =>
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
    setEmployeeToDelete(employee);
  };

  const confirmDelete = () => {
    if (employeeToDelete) {
      deleteEmployeeMutation.mutate(employeeToDelete);
      setEmployeeToDelete(null);
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

      <h2 className="text-xl font-semibold mb-4 text-gray-900">All Users</h2>

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
                  {employee.is_admin_user && (
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
                  {(user?.role === 'owner' || user?.role === 'admin' || !employee.is_admin_user) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetWageRates(employee)}
                      title="Set Wage Rates"
                      className="h-8 w-8 p-0"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChangePassword(employee)}
                    title="Change Password"
                    className="h-8 w-8 p-0"
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmployeeToTerminate(employee)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 w-8 p-0"
                    title="Terminate Employee"
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(employee)}
                    className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
                    title="Delete (Permanent)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

      {roleChangeAdmin && (
        <AdminRoleChange
          adminUser={roleChangeAdmin}
          onClose={() => setRoleChangeAdmin(null)}
        />
      )}

      {/* Terminate Employee Dialog */}
      <TerminateEmployeeDialog
        employee={employeeToTerminate}
        open={!!employeeToTerminate}
        onOpenChange={(open) => !open && setEmployeeToTerminate(null)}
      />

      {/* Modern Delete Confirmation Dialog */}
      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Employee
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete <span className="font-semibold text-foreground">{employeeToDelete?.full_name}</span>?
              </p>
              <p className="text-sm">
                This will permanently remove:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 pl-2">
                <li>Employee profile and information</li>
                <li>All associated timesheet records</li>
                <li>Wage rate settings</li>
              </ul>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeesPage;
