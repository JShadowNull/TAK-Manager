import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared/ui/shadcn/dialog';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

interface AdminPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { username: string; is_admin: boolean } | null;
  onSuccess?: () => void;
}

export const AdminPasswordResetDialog: React.FC<AdminPasswordResetDialogProps> = ({
  open,
  onOpenChange,
  user,
  onSuccess
}) => {
  const { toast } = useToast();
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmNewUserPassword, setConfirmNewUserPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isResettingUserPassword, setIsResettingUserPassword] = useState(false);
  const [passwordResetErrors, setPasswordResetErrors] = useState<{ [key: string]: string }>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setNewUserPassword('');
      setConfirmNewUserPassword('');
      setAdminPassword('');
      setPasswordResetErrors({});
    }
  }, [open]);

  // Handle admin password reset
  const handleAdminPasswordReset = async () => {
    if (!user || !adminPassword) {
      toast({
        title: "Error",
        description: "Your password is required to reset user password",
        variant: "destructive"
      });
      return;
    }
    
    // Reset errors
    setPasswordResetErrors({});
    
    // Check if passwords match
    if (newUserPassword !== confirmNewUserPassword) {
      setPasswordResetErrors({
        confirmPassword: "Passwords do not match"
      });
      return;
    }
    
    // Check password length
    if (newUserPassword.length < 8) {
      setPasswordResetErrors({
        newPassword: "Password must be at least 8 characters"
      });
      return;
    }
    
    setIsResettingUserPassword(true);
    
    try {
      const response = await axios.post('/api/auth/admin-reset-password', {
        username: user.username,
        admin_password: adminPassword,
        new_password: newUserPassword,
        confirm_password: confirmNewUserPassword
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: `Password for "${user.username}" has been reset`,
        });
        
        // Close dialog and clear form
        onOpenChange(false);
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to reset password",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Handle API errors
        toast({
          title: "Error",
          description: error.response.data.detail || "Failed to reset password",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      }
    } finally {
      setIsResettingUserPassword(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Reset the password for user "{user.username}". They will need to use this new password to log in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-user-password">New Password</Label>
            <Input 
              id="new-user-password" 
              type="password"
              placeholder="New Password"
              className={`w-full ${passwordResetErrors.newPassword ? 'border-red-500' : ''}`}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              required
            />
            {passwordResetErrors.newPassword && (
              <p className="text-sm text-red-500 mt-1">{passwordResetErrors.newPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-user-password">Confirm Password</Label>
            <Input 
              id="confirm-new-user-password" 
              type="password"
              placeholder="Confirm New Password"
              className={`w-full ${passwordResetErrors.confirmPassword ? 'border-red-500' : ''}`}
              value={confirmNewUserPassword}
              onChange={(e) => setConfirmNewUserPassword(e.target.value)}
              required
            />
            {passwordResetErrors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{passwordResetErrors.confirmPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password-reset">Enter your password to confirm</Label>
            <Input
              id="admin-password-reset"
              type="password"
              placeholder="Your Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResettingUserPassword}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdminPasswordReset}
            disabled={!adminPassword || !newUserPassword || !confirmNewUserPassword || isResettingUserPassword}
          >
            {isResettingUserPassword ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...
              </span>
            ) : (
              'Reset Password'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 