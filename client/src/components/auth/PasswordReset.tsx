import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/shadcn/card/card';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { KeyRound, Loader2, Check } from 'lucide-react';
import axios from 'axios';
import { z } from 'zod';

// Define validation schema
const passwordResetSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required" }),
  newPassword: z.string().min(8, { message: "New password must be at least 8 characters" }),
  confirmPassword: z.string().min(8, { message: "Confirm password must be at least 8 characters" })
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const PasswordReset: React.FC = () => {
  const { toast } = useToast();
  
  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordResetErrors, setPasswordResetErrors] = useState<{ [key: string]: string }>({});
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Reset password handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors and success state
    setPasswordResetErrors({});
    setPasswordResetSuccess(false);
    
    try {
      // Validate inputs
      const validatedData = passwordResetSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword
      });
      
      setIsResettingPassword(true);
      
      // Call API
      const response = await axios.post('/api/auth/reset-password', {
        current_password: validatedData.currentPassword,
        new_password: validatedData.newPassword,
        confirm_password: validatedData.confirmPassword
      });
      
      if (response.data.success) {
        setPasswordResetSuccess(true);
        toast({
          title: "Success",
          description: "Password has been successfully updated",
        });
        
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({
          title: "Error",
          description: "Failed to reset password",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const errors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path) {
            errors[err.path[0]] = err.message;
          }
        });
        setPasswordResetErrors(errors);
      } else if (axios.isAxiosError(error) && error.response) {
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
      setIsResettingPassword(false);
    }
  };

  return (
    <Card className="w-full max-w-1/3 mx-auto">
      <CardHeader>
        <div className="flex items-center">
          <KeyRound className="h-6 w-6 mr-2" />
          <CardTitle>Reset Password</CardTitle>
        </div>
        <CardDescription>
          Change your account password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input 
              id="current-password" 
              type="password"
              placeholder="Current Password"
              className={`w-full ${passwordResetErrors.currentPassword ? 'border-red-500' : ''}`}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            {passwordResetErrors.currentPassword && (
              <p className="text-sm text-red-500 mt-1">{passwordResetErrors.currentPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input 
              id="new-password" 
              type="password"
              placeholder="New Password"
              className={`w-full ${passwordResetErrors.newPassword ? 'border-red-500' : ''}`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {passwordResetErrors.newPassword && (
              <p className="text-sm text-red-500 mt-1">{passwordResetErrors.newPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input 
              id="confirm-password" 
              type="password"
              placeholder="Confirm New Password"
              className={`w-full ${passwordResetErrors.confirmPassword ? 'border-red-500' : ''}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {passwordResetErrors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{passwordResetErrors.confirmPassword}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isResettingPassword}
            >
              {isResettingPassword ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                </span>
              ) : passwordResetSuccess ? (
                <span className="flex items-center justify-center">
                  <Check className="mr-2 h-4 w-4" /> Password Reset
                </span>
              ) : (
                'Reset Password'
              )}
          </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}; 