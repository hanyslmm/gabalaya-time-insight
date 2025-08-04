import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface Employee {
  id: string;
  staff_id: string;
  full_name: string;
  role: string;
}

interface AdminPasswordChangeProps {
  employee: Employee;
  onClose: () => void;
}

const AdminPasswordChange: React.FC<AdminPasswordChangeProps> = ({ employee, onClose }) => {
  const { user } = useAuth();
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

  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No authentication token found');

      const { data: result, error } = await supabase.functions.invoke('unified-auth', {
        body: {
          action: 'change-password',
          targetUser: employee.staff_id,
          currentPassword: data.currentPassword || '', // Empty for admin actions
          newPassword: data.newPassword,
          token: token
        }
      });

      if (error) {
        throw new Error('Failed to change password');
      }
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to change password');
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Password changed successfully!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to change password');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    // If admin is changing someone else's password, don't require current password
    const isChangingOwnPassword = user?.username === employee.staff_id;
    if (isChangingOwnPassword && !passwordData.currentPassword) {
      toast.error('Current password is required');
      return;
    }

    changePasswordMutation.mutate(passwordData);
  };

  const isChangingOwnPassword = user?.username === employee.staff_id;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>
              Change Password - {employee.full_name}
              {!isChangingOwnPassword && " (Admin Action)"}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex space-x-2 pt-4">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>

        {!isChangingOwnPassword && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Admin Note:</strong> You are changing the password for another admin user. 
              This action will be logged for security purposes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminPasswordChange;
