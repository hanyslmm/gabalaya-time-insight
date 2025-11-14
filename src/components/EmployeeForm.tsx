
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { z } from 'zod';
import ProfileAvatar from './ProfileAvatar';
import { Eye, EyeOff, Lock, DollarSign, UserX, Trash2, AlertTriangle, Calendar } from 'lucide-react';
import { TERMINATION_REASONS } from '@/constants/terminationReasons';

interface Employee {
  id?: string;
  staff_id: string;
  full_name: string;
  role: string;
  hiring_date: string;
  email?: string;
  phone_number?: string;
  morning_wage_rate?: number;
  night_wage_rate?: number;
  is_admin_user?: boolean;
  organization_id?: string;
}

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
}

const employeeSchema = z.object({
  staff_id: z.string().min(1, 'Staff ID is required').max(50, 'Staff ID must be less than 50 characters'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be less than 100 characters'),
  role: z.string().min(1, 'Role is required'),
  hiring_date: z.string().min(1, 'Hiring date is required'),
  email: z.union([z.string().email('Invalid email format'), z.literal(''), z.undefined()]).optional(),
  phone_number: z.union([z.string(), z.literal(''), z.undefined()]).optional(),
});

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [formData, setFormData] = useState<Employee>({
    staff_id: '',
    full_name: '',
    role: '',
    hiring_date: '',
    email: '',
    phone_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Wage rates state
  const [morningRate, setMorningRate] = useState(17.00);
  const [nightRate, setNightRate] = useState(20.00);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Termination state
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [terminationReason, setTerminationReason] = useState('');
  const [eligibleForRehire, setEligibleForRehire] = useState<string>('true');
  const [terminationNotes, setTerminationNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
  
  // Fetch roles from database
  const { data: rolesData = [] } = useQuery({
    queryKey: ['employee-roles', activeOrganizationId],
    enabled: !!activeOrganizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_roles')
        .select('name')
        .eq('organization_id', activeOrganizationId)
        .order('name');
      
      if (error) {
        console.error('Failed to fetch roles:', error);
        return [];
      }
      return data || [];
    }
  });
  
  const availableRoles = [
    ...rolesData.map((r: any) => r.name),
    'Employee',
    'admin',
    'owner'
  ].filter((role, index, self) => self.indexOf(role) === index);

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        email: employee.email || '',
        phone_number: employee.phone_number || ''
      });
      setMorningRate(employee.morning_wage_rate || 17.00);
      setNightRate(employee.night_wage_rate || 20.00);
    }
  }, [employee]);

  const validateForm = () => {
    try {
      const cleanFormData = {
        ...formData,
        email: formData.email?.trim() || undefined,
        phone_number: formData.phone_number?.trim() || undefined
      };

      if (cleanFormData.email && cleanFormData.email.length > 0) {
        const emailToValidate = cleanFormData.email;
        const emailSchema = z.string().email('Invalid email format');
        emailSchema.parse(emailToValidate);
      }

      employeeSchema.parse(cleanFormData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // Basic info mutation
  const mutation = useMutation({
    mutationFn: async (data: Employee) => {
      const cleanData = {
        ...data,
        email: data.email?.trim() || null,
        phone_number: data.phone_number?.trim() || null
      };

      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;

      if (employee?.id) {
        const { error } = await supabase
          .from('employees')
          .update({ 
            staff_id: cleanData.staff_id,
            full_name: cleanData.full_name,
            role: cleanData.role,
            hiring_date: cleanData.hiring_date,
            email: cleanData.email || null,
            phone_number: cleanData.phone_number || null,
            organization_id: activeOrganizationId
          })
          .eq('id', employee.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({ 
            staff_id: cleanData.staff_id,
            full_name: cleanData.full_name,
            role: cleanData.role,
            hiring_date: cleanData.hiring_date,
            email: cleanData.email || null,
            phone_number: cleanData.phone_number || null,
            organization_id: activeOrganizationId
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(employee ? t('employeeUpdated') : t('employeeAdded'));
      if (!employee) onClose(); // Only close if creating new employee
    },
    onError: (error: any) => {
      toast.error(error.message || t('error'));
    }
  });

  // Wage rates mutation
  const wageRatesMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('Employee ID required');
      
      if ((employee as any).is_admin_user) {
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('*')
          .eq('staff_id', employee.staff_id)
          .maybeSingle();

        if (existingEmployee) {
          const { error } = await supabase
            .from('employees')
            .update({
              morning_wage_rate: morningRate,
              night_wage_rate: nightRate
            })
            .eq('staff_id', employee.staff_id);
          if (error) throw error;
        } else {
          const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
          const { error } = await supabase
            .from('employees')
            .insert({
              staff_id: employee.staff_id,
              full_name: employee.full_name,
              role: 'Employee',
              hiring_date: new Date().toISOString().split('T')[0],
              morning_wage_rate: morningRate,
              night_wage_rate: nightRate,
              organization_id: activeOrganizationId
            });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('employees')
          .update({
            morning_wage_rate: morningRate,
            night_wage_rate: nightRate
          })
          .eq('id', employee.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Wage rates updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Error updating wage rates: ${error.message}`);
    }
  });

  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No authentication token found');

      const { data: result, error } = await supabase.functions.invoke('unified-auth', {
        body: {
          action: 'change-password',
          targetUser: employee!.staff_id,
          currentPassword: data.currentPassword || '',
          newPassword: data.newPassword,
          token: token
        }
      });

      if (error || !result?.success) {
        const hashed = data.newPassword;
        const { data: rpcResult, error: rpcError } = await (supabase as any).rpc('force_change_admin_password_hashed', {
          p_username: employee!.staff_id,
          p_password_hash: hashed
        });
        if (rpcError || !rpcResult?.success) {
          throw new Error(rpcResult?.error || rpcError?.message || 'Failed to change password');
        }
        return rpcResult;
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to change password');
    }
  });

  // Termination mutation
  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('No employee selected');

      const updateData = {
        status: 'terminated',
        termination_date: terminationDate,
        termination_reason: terminationReason,
        eligible_for_rehire: eligibleForRehire === 'true',
        termination_notes: terminationNotes || null,
        last_organization_id: employee.organization_id,
        organization_id: null,
      };

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', employee.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Employee terminated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to terminate employee');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('No employee selected');
      
      if (employee.is_admin_user) {
        const { error } = await supabase
          .from('admin_users')
          .delete()
          .eq('id', employee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', employee.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deleted successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to delete employee');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }
    setLoading(true);
    mutation.mutate(formData);
    setLoading(false);
  };

  const handleWageRatesSave = () => {
    if (!employee?.id) {
      toast.error('Please save employee info first');
      return;
    }
    wageRatesMutation.mutate();
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    const isChangingOwnPassword = user?.username === employee?.staff_id;
    if (isChangingOwnPassword && !passwordData.currentPassword) {
      toast.error('Current password is required');
      return;
    }
    passwordMutation.mutate(passwordData);
  };

  const handleTerminate = () => {
    if (!terminationReason) {
      toast.error('Please select a termination reason');
      return;
    }
    terminateMutation.mutate();
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleInputChange = (field: keyof Employee, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const isChangingOwnPassword = user?.username === employee?.staff_id;
  const isEditMode = !!employee;

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? t('editEmployee') : t('addEmployee')}
          </DialogTitle>
        </DialogHeader>
        
          {isEditMode ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="wages">Wages</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="terminate">Terminate</TabsTrigger>
                <TabsTrigger value="delete" className="text-destructive">Delete</TabsTrigger>
              </TabsList>
              
              {/* Basic Info Tab */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formData.full_name && (
                    <div className="flex justify-center py-4">
                      <div className="text-center space-y-2">
                        <ProfileAvatar employeeName={formData.full_name} size="lg" showChangeOption={true} />
                        <p className="text-sm text-muted-foreground">Employee Avatar</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="staff_id">{t('staffId')} *</Label>
                      <Input
                        id="staff_id"
                        value={formData.staff_id}
                        onChange={(e) => handleInputChange('staff_id', e.target.value)}
                        className={errors.staff_id ? 'border-red-500' : ''}
                      />
                      {errors.staff_id && <p className="text-sm text-red-500">{errors.staff_id}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">{t('fullName')} *</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        className={errors.full_name ? 'border-red-500' : ''}
                      />
                      {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">{t('role')} *</Label>
                      <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                        <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hiring_date">{t('hiringDate')} *</Label>
                      <Input
                        id="hiring_date"
                        type="date"
                        value={formData.hiring_date}
                        onChange={(e) => handleInputChange('hiring_date', e.target.value)}
                        className={errors.hiring_date ? 'border-red-500' : ''}
                      />
                      {errors.hiring_date && <p className="text-sm text-red-500">{errors.hiring_date}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')} (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={errors.email ? 'border-red-500' : ''}
                      placeholder="Optional - enter email if available"
                    />
                    {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                    <p className="text-xs text-muted-foreground">Leave empty if not available</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">{t('phoneNumber')} (Optional)</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number || ''}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      className={errors.phone_number ? 'border-red-500' : ''}
                      placeholder="Optional - enter phone if available"
                    />
                    {errors.phone_number && <p className="text-sm text-red-500">{errors.phone_number}</p>}
                    <p className="text-xs text-muted-foreground">Leave empty if not available</p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={loading || mutation.isPending}>
                      {loading || mutation.isPending ? t('loading') : t('save')}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              
              {/* Wage Rates Tab */}
              <TabsContent value="wages" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="morning-rate">Morning Wage Rate (LE/hr)</Label>
                    <Input
                      id="morning-rate"
                      type="number"
                      step="0.01"
                      value={morningRate}
                      onChange={(e) => setMorningRate(parseFloat(e.target.value) || 0)}
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="night-rate">Night Wage Rate (LE/hr)</Label>
                    <Input
                      id="night-rate"
                      type="number"
                      step="0.01"
                      value={nightRate}
                      onChange={(e) => setNightRate(parseFloat(e.target.value) || 0)}
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button onClick={handleWageRatesSave} disabled={wageRatesMutation.isPending}>
                      {wageRatesMutation.isPending ? 'Saving...' : 'Save Rates'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Password Change Tab */}
              <TabsContent value="password" className="space-y-4 mt-4">
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {isChangingOwnPassword && (
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          placeholder="Enter current password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        >
                          {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="Enter new password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={passwordMutation.isPending}>
                      {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              
              {/* Terminate Tab */}
              <TabsContent value="terminate" className="space-y-4 mt-4">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="termination-date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Termination Date *
                    </Label>
                    <input
                      id="termination-date"
                      type="date"
                      value={terminationDate}
                      onChange={(e) => setTerminationDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termination-reason" className="text-sm font-medium">
                      Reason for Termination *
                    </Label>
                    <Select value={terminationReason} onValueChange={setTerminationReason}>
                      <SelectTrigger id="termination-reason">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINATION_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eligible-rehire" className="text-sm font-medium">
                      Eligible for Rehire? *
                    </Label>
                    <Select value={eligibleForRehire} onValueChange={setEligibleForRehire}>
                      <SelectTrigger id="eligible-rehire">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes - Eligible for rehire</SelectItem>
                        <SelectItem value="false">No - Not eligible for rehire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termination-notes" className="text-sm font-medium">
                      Additional Notes (Optional)
                    </Label>
                    <Textarea
                      id="termination-notes"
                      placeholder="Add any additional context or notes about this termination..."
                      value={terminationNotes}
                      onChange={(e) => setTerminationNotes(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">Note:</span> This employee will be moved to the 
                      "Terminated Employees" section and removed from active staff. Their historical 
                      timesheet data will be preserved.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={onClose} disabled={terminateMutation.isPending}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleTerminate}
                      disabled={terminateMutation.isPending || !terminationReason}
                    >
                      {terminateMutation.isPending ? 'Terminating...' : 'Terminate Employee'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Delete Tab */}
              <TabsContent value="delete" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h3 className="font-semibold text-destructive">Delete Employee</h3>
                    </div>
                    <p className="text-sm text-foreground mb-3">
                      Are you sure you want to permanently delete <span className="font-semibold">{employee?.full_name}</span>?
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      This will permanently remove:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1 pl-2 text-muted-foreground">
                      <li>Employee profile and information</li>
                      <li>All associated timesheet records</li>
                      <li>Wage rate settings</li>
                    </ul>
                    <p className="text-sm font-semibold text-destructive mt-3">
                      ⚠️ This action cannot be undone.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete Employee
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            // New employee form (no tabs)
        <form onSubmit={handleSubmit} className="space-y-4">
          {formData.full_name && (
            <div className="flex justify-center py-4">
              <div className="text-center space-y-2">
                <ProfileAvatar employeeName={formData.full_name} size="lg" showChangeOption={true} />
                <p className="text-sm text-muted-foreground">Employee Avatar</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff_id">{t('staffId')} *</Label>
              <Input
                id="staff_id"
                value={formData.staff_id}
                onChange={(e) => handleInputChange('staff_id', e.target.value)}
                className={errors.staff_id ? 'border-red-500' : ''}
              />
              {errors.staff_id && <p className="text-sm text-red-500">{errors.staff_id}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">{t('fullName')} *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                className={errors.full_name ? 'border-red-500' : ''}
              />
              {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">{t('role')} *</Label>
              <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hiring_date">{t('hiringDate')} *</Label>
              <Input
                id="hiring_date"
                type="date"
                value={formData.hiring_date}
                onChange={(e) => handleInputChange('hiring_date', e.target.value)}
                className={errors.hiring_date ? 'border-red-500' : ''}
              />
              {errors.hiring_date && <p className="text-sm text-red-500">{errors.hiring_date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')} (Optional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
              placeholder="Optional - enter email if available"
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            <p className="text-xs text-muted-foreground">Leave empty if not available</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">{t('phoneNumber')} (Optional)</Label>
            <Input
              id="phone_number"
              value={formData.phone_number || ''}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              className={errors.phone_number ? 'border-red-500' : ''}
              placeholder="Optional - enter phone if available"
            />
            {errors.phone_number && <p className="text-sm text-red-500">{errors.phone_number}</p>}
            <p className="text-xs text-muted-foreground">Leave empty if not available</p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading || mutation.isPending}>
              {loading || mutation.isPending ? t('loading') : t('save')}
            </Button>
          </div>
        </form>
          )}
      </DialogContent>
    </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Confirm Delete
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you absolutely sure you want to delete <span className="font-semibold text-foreground">{employee?.full_name}</span>?
              </p>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Employee'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmployeeForm;
