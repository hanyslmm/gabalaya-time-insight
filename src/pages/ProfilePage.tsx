import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save, User, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
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
    fetchEmployeeData();
  }, [user]);

  const fetchEmployeeData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('staff_id', user.username)
        .single();

      if (error) throw error;

      setEmployee(data);
      setFormData({
        email: data.email || '',
        phone_number: data.phone_number || ''
      });
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!employee) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          email: formData.email || null,
          phone_number: formData.phone_number || null
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      fetchEmployeeData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setChangingPassword(true);
    try {
      // Check if user is admin (from admin_users table)
      if (user.role === 'admin') {
        // Use the admin password change function
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('No authentication token found');

        const { data: result, error } = await supabase.functions.invoke('change-admin-password', {
          body: {
            username: user.username,
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
            token: token
          }
        });

        if (error) throw error;
        if (!result.success) throw new Error(result.error);
      } else {
        // For regular employees, use the legacy method
        // Note: This needs to be implemented properly for employee password changes
        toast.error('Password change for employees is not yet implemented');
        return;
      }

      toast.success('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-6 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">Unable to load your profile information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your personal information and contact details
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile Picture Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" alt={employee.full_name} />
              <AvatarFallback className="text-lg">
                {employee.full_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm" className="mb-2">
                <Camera className="h-4 w-4 mr-2" />
                Change Photo
              </Button>
              <p className="text-sm text-muted-foreground">
                JPG, PNG or GIF. Max size 2MB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={employee.full_name}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="staff_id">Staff ID</Label>
                <Input
                  id="staff_id"
                  value={employee.staff_id}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={employee.role}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="hiring_date">Hiring Date</Label>
                <Input
                  id="hiring_date"
                  value={new Date(employee.hiring_date).toLocaleDateString()}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
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
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
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
            <Button 
              onClick={handlePasswordChange} 
              disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="w-full"
            >
              <Lock className="h-4 w-4 mr-2" />
              {changingPassword ? 'Changing Password...' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;