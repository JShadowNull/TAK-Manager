import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared/ui/shadcn/dialog';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

interface AdminStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { username: string; is_admin: boolean } | null;
  newAdminStatus: boolean;
  onSuccess: () => void;
}

export const AdminStatusDialog: React.FC<AdminStatusDialogProps> = ({
  open,
  onOpenChange,
  user,
  newAdminStatus,
  onSuccess
}) => {
  const { toast } = useToast();
  const [adminPassword, setAdminPassword] = useState('');
  const [isUpdatingAdminStatus, setIsUpdatingAdminStatus] = useState(false);

  // Reset password when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setAdminPassword('');
    }
  }, [open]);

  // Handle update admin status
  const handleUpdateAdminStatus = async () => {
    if (!user || !adminPassword) {
      toast({
        title: "Error",
        description: "Password is required to update admin status",
        variant: "destructive"
      });
      return;
    }
    
    setIsUpdatingAdminStatus(true);
    
    try {
      const response = await axios.post('/api/auth/update-admin-status', {
        username: user.username,
        admin_password: adminPassword,
        is_admin: newAdminStatus
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: `User "${user.username}" admin status updated`,
        });
        
        // Close dialog, clear form and refresh user list
        onOpenChange(false);
        setAdminPassword('');
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: "Failed to update admin status",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Handle API errors
        toast({
          title: "Error",
          description: error.response.data.detail || "Failed to update admin status",
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
      setIsUpdatingAdminStatus(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{newAdminStatus ? "Grant Admin Privileges" : "Revoke Admin Privileges"}</DialogTitle>
          <DialogDescription>
            {newAdminStatus 
              ? `Are you sure you want to make "${user.username}" an administrator? They will have full access to manage users.`
              : `Are you sure you want to revoke admin privileges from "${user.username}"?`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password-action">Enter your password to confirm</Label>
            <Input
              id="admin-password-action"
              type="password"
              placeholder="Your Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdatingAdminStatus}
          >
            Cancel
          </Button>
          <Button
            variant={newAdminStatus ? "primary" : "danger"}
            onClick={handleUpdateAdminStatus}
            disabled={!adminPassword || isUpdatingAdminStatus}
          >
            {isUpdatingAdminStatus ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </span>
            ) : (
              newAdminStatus ? 'Grant Admin Privileges' : 'Revoke Admin Privileges'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 