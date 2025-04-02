import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shared/ui/shadcn/dialog';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

interface RemoveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  currentUsername: string;
  onSuccess: () => void;
}

export const RemoveUserDialog: React.FC<RemoveUserDialogProps> = ({
  open,
  onOpenChange,
  username,
  currentUsername,
  onSuccess
}) => {
  const { toast } = useToast();
  const [adminPassword, setAdminPassword] = useState('');
  const [isRemovingUser, setIsRemovingUser] = useState(false);

  // Remove user handler
  const handleRemoveUser = async () => {
    if (!username || !adminPassword) {
      toast({
        title: "Error",
        description: "Password is required to remove a user",
        variant: "destructive"
      });
      return;
    }
    
    if (username === currentUsername) {
      toast({
        title: "Error",
        description: "You cannot remove your own account",
        variant: "destructive"
      });
      onOpenChange(false);
      return;
    }
    
    setIsRemovingUser(true);
    
    try {
      const response = await axios.post('/api/auth/remove-user', {
        username: username,
        admin_password: adminPassword
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: `User "${username}" has been removed`,
        });
        
        // Close dialog, clear form and refresh user list
        onOpenChange(false);
        setAdminPassword('');
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: "Failed to remove user",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Handle API errors
        toast({
          title: "Error",
          description: error.response.data.detail || "Failed to remove user",
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
      setIsRemovingUser(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAdminPassword('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove the user "{username}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Enter your password to confirm</Label>
            <Input
              id="admin-password"
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
            disabled={isRemovingUser}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRemoveUser}
            disabled={!adminPassword || isRemovingUser}
          >
            {isRemovingUser ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...
              </span>
            ) : (
              'Remove User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 