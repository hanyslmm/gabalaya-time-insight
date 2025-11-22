import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Edit, Search, Lock, UserX, DollarSign, BarChart3 } from 'lucide-react';
import EmployeeForm from '@/components/EmployeeForm';
import EmployeeStats from '@/components/EmployeeStats';
import { useAuth } from '@/hooks/useAuth';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  role: string; // Legacy field, kept for backward compatibility
  permission_level?: string;
  roles?: string[]; // Array of role names from employee_role_assignments
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

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const EmployeesPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: employees, isLoading, error: employeesError } = useQuery({
    queryKey: ['employees', (user as any)?.current_organization_id || user?.organization_id],
    queryFn: async () => {
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;

      console.log('🔍 EmployeesPage QUERY START');
      console.log('🔍 User object:', user);
      console.log('🔍 Active Organization ID:', activeOrganizationId);

      // Fetch only active employees
      const query: any = (supabase as any)
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      let employeeQuery = query;

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

      // Check which employees are also admin users
      const employeeIds = (employeeData || []).map((emp: any) => emp.id);
      let adminUsers: any[] = [];
      
      if (employeeIds.length > 0) {
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id, username, role')
          .in('id', employeeIds);
        adminUsers = adminData || [];
      }
      
      // Create a set of admin user IDs for quick lookup
      const adminUserIds = new Set(adminUsers.map(admin => admin.id));
      
      // Mark employees as admin users if they exist in admin_users table
      const employeesWithAdminFlag = (employeeData || []).map((emp: any) => ({
        ...emp,
        is_admin_user: adminUserIds.has(emp.id)
      })) as (Employee & { is_admin_user?: boolean })[];

      // Fetch roles for all employees
      const employeeIdsForRoles = employeesWithAdminFlag.map(emp => emp.id);
      let rolesMap: Record<string, string[]> = {};
      
      if (employeeIdsForRoles.length > 0) {
        const { data: roleAssignments } = await supabase
          .from('employee_role_assignments')
          .select(`
            employee_id,
            employee_roles!inner(name)
          `)
          .eq('is_active', true)
          .in('employee_id', employeeIdsForRoles);
        
        if (roleAssignments) {
          roleAssignments.forEach((assignment: any) => {
            const empId = assignment.employee_id;
            const roleName = assignment.employee_roles?.name;
            if (empId && roleName) {
              if (!rolesMap[empId]) {
                rolesMap[empId] = [];
              }
              rolesMap[empId].push(roleName);
            }
          });
        }
      }

      // Add roles to each employee
      const result = employeesWithAdminFlag.map((emp: any) => ({
        ...emp,
        roles: rolesMap[emp.id] || [],
        permission_level: emp.permission_level || 'employee'
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
    const activeOrgId = (user as any)?.current_organization_id || user?.organization_id;
    const regular = (employees || []).map((emp: any) => ({
      ...emp,
      roles: emp.roles || []
    })) as Employee[];
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
      organization_id: admin.organization_id || activeOrgId,
      is_admin_user: true
    }));
    return [...regular, ...adminsProjected];
  }, [employees, adminUsers, user]);

  const filteredEmployees = unifiedEmployees?.filter(employee => {
    const searchLower = searchTerm.toLowerCase();
    const matchesName = employee.full_name.toLowerCase().includes(searchLower);
    const matchesStaffId = employee.staff_id.toLowerCase().includes(searchLower);
    const matchesRole = employee.role?.toLowerCase().includes(searchLower) || false;
    const matchesRoles = employee.roles?.some(role => role.toLowerCase().includes(searchLower)) || false;
    return matchesName || matchesStaffId || matchesRole || matchesRoles;
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleViewStats = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('employees')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('manageEmployeeRecords')}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('addEmployee')}</span>
        </Button>
      </div>

      <Card className="mb-6 border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold">{t('allEmployees')} ({filteredEmployees.length})</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('show')}</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(parseInt(value, 10));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={option.toString()}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('noEmployeesFound')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('name')}</TableHead>
                      <TableHead>{t('staffId')}</TableHead>
                      <TableHead>{t('role')}</TableHead>
                      <TableHead>{t('hiringDate')}</TableHead>
                      <TableHead>{t('morningRate')}</TableHead>
                      <TableHead>{t('nightRate')}</TableHead>
                      <TableHead>{t('email')}</TableHead>
                      <TableHead>{t('phone')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.map((employee) => (
                      <TableRow key={employee.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{employee.full_name}</span>
                  {employee.is_admin_user && (
                              <Lock className="h-4 w-4 text-destructive" title={t('administrator')} />
                  )}
                </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{employee.staff_id}</TableCell>
                        <TableCell>
                          {employee.roles && employee.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {employee.roles.map((role, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                                  {role}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{employee.role || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(employee.hiring_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-green-600 dark:text-green-400 font-medium">
                          LE {employee.morning_wage_rate?.toFixed(2) || '17.00'}
                        </TableCell>
                        <TableCell className="text-green-600 dark:text-green-400 font-medium">
                          LE {employee.night_wage_rate?.toFixed(2) || '20.00'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{employee.email || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{employee.phone_number || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(employee)}
                              title={t('editEmployee')}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                              onClick={() => handleViewStats(employee)}
                              title={t('viewStatistics')}
                      className="h-8 w-8 p-0"
                    >
                              <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                  
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t('showing')} {startIndex + 1} {t('to')} {Math.min(startIndex + itemsPerPage, filteredEmployees.length)} {t('of')} {filteredEmployees.length} {t('employees')}
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNumber)}
                              isActive={currentPage === pageNumber}
                              className="cursor-pointer"
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages || totalPages === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
            </CardContent>
          </Card>

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
    </div>
  );
};

export default EmployeesPage;
