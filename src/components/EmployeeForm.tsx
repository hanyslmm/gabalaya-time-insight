
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { z } from 'zod';
import ProfileAvatar from './ProfileAvatar';

interface Employee {
  id?: string;
  staff_id: string;
  full_name: string;
  role: string;
  hiring_date: string;
  email?: string;
  phone_number?: string;
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
  // Make email and phone truly optional - allow empty strings and undefined
  email: z.union([z.string().email('Invalid email format'), z.literal(''), z.undefined()]).optional(),
  phone_number: z.union([z.string(), z.literal(''), z.undefined()]).optional(),
});

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
  const [availableRoles, setAvailableRoles] = useState([
    'Champion',
    'Barista', 
    'Host',
    'Employee',
    'admin'
  ]);

  useEffect(() => {
    // Load roles from localStorage
    const savedRoles = localStorage.getItem('employee-roles');
    if (savedRoles) {
      const roles = JSON.parse(savedRoles);
      setAvailableRoles(roles.map((role: any) => role.name));
    }
  }, []);

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        email: employee.email || '',
        phone_number: employee.phone_number || ''
      });
    }
  }, [employee]);

  const validateForm = () => {
    try {
      // Create a clean version of form data for validation
      const cleanFormData = {
        ...formData,
        email: formData.email?.trim() || undefined,
        phone_number: formData.phone_number?.trim() || undefined
      };

      // If email is provided and not empty, validate it
      if (cleanFormData.email && cleanFormData.email.length > 0) {
        // Remove from cleanFormData and validate separately
        const emailToValidate = cleanFormData.email;
        const emailSchema = z.string().email('Invalid email format');
        emailSchema.parse(emailToValidate);
      }

      // Validate the complete schema
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

  const mutation = useMutation({
    mutationFn: async (data: Employee) => {
      // Clean the data before sending
      const cleanData = {
        ...data,
        email: data.email?.trim() || null,
        phone_number: data.phone_number?.trim() || null
      };

      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id || null;

      // Check if this is an admin user
      const isAdminUser = (employee as any)?.is_admin_user;

      if (employee?.id) {
        if (isAdminUser) {
          // Update admin user in admin_users table
          const { error } = await supabase
            .from('admin_users')
            .update({ 
              full_name: cleanData.full_name,
              role: cleanData.role,
              organization_id: activeOrganizationId
            })
            .eq('id', employee.id);
          
          if (error) throw error;
        } else {
          // Update regular employee in employees table
          const { error } = await supabase
            .from('employees')
            .update({ ...cleanData, organization_id: activeOrganizationId })
            .eq('id', employee.id);
          
          if (error) throw error;
        }
      } else {
        // Create new employee (always in employees table)
        const { error } = await supabase
          .from('employees')
          .insert({ ...cleanData, organization_id: activeOrganizationId });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(employee ? t('employeeUpdated') : t('employeeAdded'));
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || t('error'));
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

  const handleInputChange = (field: keyof Employee, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {employee ? t('editEmployee') : t('addEmployee')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Avatar Section */}
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
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeForm;
