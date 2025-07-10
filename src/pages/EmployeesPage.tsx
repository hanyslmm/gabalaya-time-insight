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
  is_admin_user?: boolean; // Flag to identify admin users
}

const EmployeesPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [wageRateEmployee, setWageRateEmployee] = useState<Employee | null>(null);
  const [passwordChangeEmployee, setPasswordChangeEmployee] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      // Fetch regular employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (employeeError) throw employeeError;

      // Fetch admin users
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (adminError) throw adminError;

      // Combine and format data - admin users as special employees
      const combinedData = [
        ...(employeeData || []),
        ...(adminData || []).map(admin => ({
          id: admin.id,
          staff_id: admin.username,
          full_name: admin.full_name || admin.username,
          role: 'admin',
          hiring_date: admin.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          email: null,
          phone_number: null,
          morning_wage_rate: null,
          night_wage_rate: null,
          is_admin_user: true // Flag to identify admin users
        }))
      ];

      return combinedData as (Employee & { is_admin_user?: boolean })[];
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employee: Employee) => {
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
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = (employee: Employee) => {
    if (employee.is_admin_user) {
      toast.error('Admin users cannot be deleted from employee management');
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{employee.full_name}</h3>
                  <p className="text-sm text-gray-600">{employee.staff_id}</p>
                </div>
                <div className="flex space-x-1">
                  {employee.is_admin_user ? (
                    // Admin user actions
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChangePassword(employee)}
                        title="Change Password"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    // Regular employee actions
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetWageRates(employee)}
                        title="Set Wage Rates"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(employee)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {employee.is_admin_user ? (
                  // Admin user content
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-5 w-5 text-red-600" />
                        <p className="text-sm font-semibold text-red-800">Administrator Account</p>
                      </div>
                      <p className="text-xs text-red-600 mt-1">Full system access with password management</p>
                    </div>
                    
                    <div className="border-t pt-2 space-y-1">
                      <p><span className="font-medium text-gray-600">Username:</span> <span className="text-gray-900">{employee.staff_id}</span></p>
                      <p><span className="font-medium text-gray-600">{t('role')}:</span> <span className="text-gray-900 font-semibold text-red-600">{employee.role}</span></p>
                      <p><span className="font-medium text-gray-600">Created:</span> <span className="text-gray-900">{new Date(employee.hiring_date).toLocaleDateString()}</span></p>
                    </div>
                  </div>
                ) : (
                  // Regular employee content
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Morning Rate</p>
                        <p className="text-lg font-bold text-blue-900">LE {employee.morning_wage_rate?.toFixed(2) || '17.00'}</p>
                        <p className="text-xs text-blue-600">per hour</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Night Rate</p>
                        <p className="text-lg font-bold text-purple-900">LE {employee.night_wage_rate?.toFixed(2) || '20.00'}</p>
                        <p className="text-xs text-purple-600">per hour</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-2 space-y-1">
                      <p><span className="font-medium text-gray-600">{t('role')}:</span> <span className="text-gray-900">{employee.role}</span></p>
                      <p><span className="font-medium text-gray-600">{t('hiringDate')}:</span> <span className="text-gray-900">{new Date(employee.hiring_date).toLocaleDateString()}</span></p>
                      {employee.email && (
                        <p><span className="font-medium text-gray-600">{t('email')}:</span> <span className="text-gray-900">{employee.email}</span></p>
                      )}
                      {employee.phone_number && (
                        <p><span className="font-medium text-gray-600">{t('phoneNumber')}:</span> <span className="text-gray-900">{employee.phone_number}</span></p>
                      )}
                    </div>
                  </>
                )}
              </div>
              {!employee.is_admin_user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => handleViewStats(employee)}
                >
                  View Statistics
                </Button>
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
