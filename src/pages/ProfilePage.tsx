import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Mail, Phone, Calendar, Shield, Lock, Eye, EyeOff, Save } from 'lucide-react';
import MobilePageWrapper, { MobileSection, MobileHeader } from '@/components/MobilePageWrapper';
import { toast } from 'sonner';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  role: string;
  hiring_date: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone_number: ''
  });

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
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user?.username) {
      fetchEmployeeData();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // First check if user is admin (in admin_users table)
      if (user?.role === 'admin') {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('username', user.username)
          .single();

        if (adminError) {
        } else if (adminData) {
          setEmployee({
            id: adminData.id,
            staff_id: adminData.username,
            full_name: adminData.full_name || adminData.username,
            email: null,
            phone_number: null, 
            role: adminData.role,
            hiring_date: adminData.created_at?.split('T')[0] || ''
          });
          setFormData({
            email: '',
            phone_number: ''
          });
          setLoading(false);
          return;
        }
      }

      // For employees, check employees table
      const activeOrganizationId = (user as any)?.current_organization_id || user?.organization_id;
      let profileQuery = supabase
        .from('employees')
        .select('*')
        .eq('staff_id', user?.username);
      if (activeOrganizationId) {
        profileQuery = profileQuery.eq('organization_id', activeOrganizationId);
      }
      const { data: employeeData, error: employeeError } = await profileQuery.single();

      if (employeeError) {
        toast.error('Error loading profile data');
      } else if (employeeData) {
        setEmployee(employeeData);
        setFormData({
          email: employeeData.email || '',
          phone_number: employeeData.phone_number || ''
        });
      }
    } catch (error) {
      toast.error('Error loading profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!employee || employee.role === 'admin') {
      toast.error('Contact information not available for admin users');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('employees')
        .update({
          email: formData.email || null,
          phone_number: formData.phone_number || null
        })
        .eq('id', employee.id);

      if (error) throw error;

      setEmployee(prev => prev ? {
        ...prev,
        email: formData.email || undefined,
        phone_number: formData.phone_number || undefined
      } : null);

      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }

    try {
      setChangingPassword(true);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Authentication token not found');
        return;
      }

      const requestBody: any = {
        action: 'change-password',
        token,
        newPassword: passwordData.newPassword
      };

      if (user?.role === 'admin') {
        requestBody.currentPassword = passwordData.currentPassword || 'dummy_password';
      }

      const { data, error } = await supabase.functions.invoke('unified-auth', {
        body: requestBody
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Password change failed');
      }

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast.success(user?.role === 'admin' 
        ? 'Admin password updated successfully' 
        : `Password format noted. Employee passwords follow the format: ${user?.username}123`
      );

    } catch (error: any) {
      toast.error(error.message || 'Error changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'U';
    return fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <MobilePageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </MobilePageWrapper>
    );
  }

  if (!employee) {
    return (
      <MobilePageWrapper>
        <MobileHeader title="Profile" subtitle="User profile not found" />
        <MobileSection>
          <Alert>
            <AlertDescription>
              Employee profile not found. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </MobileSection>
      </MobilePageWrapper>
    );
  }

  return (
    <MobilePageWrapper>
      <MobileHeader 
        title="Profile" 
        subtitle="Manage your account information"
      />

      {/* Profile Picture and Basic Info */}
      <MobileSection>
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {getInitials(employee.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground">{employee.full_name}</h2>
                <p className="text-muted-foreground font-mono">{employee.staff_id}</p>
                <Badge variant={employee.role === 'admin' ? 'destructive' : 'secondary'} className="mt-2">
                  <Shield className="h-3 w-3 mr-1" />
                  {employee.role.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </MobileSection>

      {/* Basic Information */}
      <MobileSection>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <Label className="text-sm font-medium text-muted-foreground">Staff ID</Label>
                <div className="mt-1 text-foreground font-mono font-medium">{employee.staff_id}</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                <div className="mt-1 text-foreground font-medium capitalize">{employee.role}</div>
              </div>
              <div className="md:col-span-2 bg-muted/50 p-3 rounded-lg">
                <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                <div className="mt-1 text-foreground font-medium">{employee.full_name}</div>
              </div>
              {employee.hiring_date && (
                <div className="md:col-span-2 bg-muted/50 p-3 rounded-lg">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Hiring Date
                  </Label>
                  <div className="mt-1 text-foreground font-medium">
                    {new Date(employee.hiring_date).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </MobileSection>

      {/* Contact Information - Only for employees */}
      {employee.role !== 'admin' && (
        <MobileSection>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email address"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                  placeholder="Enter your phone number"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </MobileSection>
      )}

      {/* Password Management */}
      <MobileSection>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.role === 'employee' && (
              <Alert>
                <AlertDescription>
                  <strong>Employee Password Format:</strong> {employee.staff_id}123
                  {employee.staff_id === 'EMP085382' && (
                    <span className="block mt-1 text-primary">
                      ⚠️ Special user: Uses the same format as others.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {employee.role === 'admin' && (
              <div>
                <Label htmlFor="currentPassword" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Current Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  >
                    {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                New Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Confirm New Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword}
              className="w-full"
              variant="secondary"
            >
              <Lock className="h-4 w-4 mr-2" />
              {changingPassword ? 'Changing Password...' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>
      </MobileSection>
    </MobilePageWrapper>
  );
};

export default ProfilePage;