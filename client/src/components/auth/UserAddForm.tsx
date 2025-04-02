import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/shadcn/card/card';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { UserPlus, Loader2, Check } from 'lucide-react';
import { Checkbox } from '@/components/shared/ui/shadcn/checkbox';
import axios from 'axios';
import { z } from 'zod';

// Define validation schema
const addUserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(1, { message: "Please confirm the password" }),
  isAdmin: z.boolean().optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

interface User {
  username: string;
  is_admin: boolean;
}

interface UserAddFormProps {
  users: User[];
  currentUsername: string;
  onUserAdded: () => void;
}

export const UserAddForm: React.FC<UserAddFormProps> = ({ users, currentUsername, onUserAdded }) => {
  const { toast } = useToast();

  // User management state
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmNewUserPassword, setConfirmNewUserPassword] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserErrors, setAddUserErrors] = useState<{ [key: string]: string }>({});
  const [addUserSuccess, setAddUserSuccess] = useState(false);

  // Add user handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors and success state
    setAddUserErrors({});
    setAddUserSuccess(false);
    
    try {
      // Validate inputs
      const validatedData = addUserSchema.parse({
        username: newUsername,
        password: newUserPassword,
        confirmPassword: confirmNewUserPassword,
        isAdmin: newUserIsAdmin
      });
      
      setIsAddingUser(true);
      
      // Call API
      const response = await axios.post('/api/auth/add-user', {
        username: validatedData.username,
        password: validatedData.password,
        confirm_password: validatedData.confirmPassword,
        is_admin: validatedData.isAdmin
      });
      
      if (response.data.success) {
        setAddUserSuccess(true);
        toast({
          title: "Success",
          description: `User "${newUsername}" has been added`,
        });
        
        // Clear form and refresh user list
        setNewUsername('');
        setNewUserPassword('');
        setConfirmNewUserPassword('');
        setNewUserIsAdmin(false);
        onUserAdded();
      } else {
        toast({
          title: "Error",
          description: "Failed to add user",
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
        setAddUserErrors(errors);
      } else if (axios.isAxiosError(error) && error.response) {
        // Handle API errors
        toast({
          title: "Error",
          description: error.response.data.detail || "Failed to add user",
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
      setIsAddingUser(false);
    }
  };

  return (
    <Card className="w-full max-w-1/3 mx-auto">
      <CardHeader>
        <div className="flex items-center">
          <UserPlus className="h-6 w-6 mr-2" />
          <CardTitle>Add New User</CardTitle>
        </div>
        <CardDescription>
          Create a new user account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">Username</Label>
            <Input 
              id="new-username" 
              placeholder="Username"
              className={`w-full ${addUserErrors.username ? 'border-red-500' : ''}`}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
            {addUserErrors.username && (
              <p className="text-sm text-red-500 mt-1">{addUserErrors.username}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Password</Label>
            <Input 
              id="new-user-password" 
              type="password"
              placeholder="Password"
              className={`w-full ${addUserErrors.password ? 'border-red-500' : ''}`}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              required
            />
            {addUserErrors.password && (
              <p className="text-sm text-red-500 mt-1">{addUserErrors.password}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-user-password">Confirm Password</Label>
            <Input 
              id="confirm-new-user-password" 
              type="password"
              placeholder="Confirm Password"
              className={`w-full ${addUserErrors.confirmPassword ? 'border-red-500' : ''}`}
              value={confirmNewUserPassword}
              onChange={(e) => setConfirmNewUserPassword(e.target.value)}
              required
            />
            {addUserErrors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{addUserErrors.confirmPassword}</p>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox 
              id="is-admin"
              checked={newUserIsAdmin}
              onCheckedChange={(checked) => setNewUserIsAdmin(checked === true)}
            />
            <Label htmlFor="is-admin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Make this user an administrator
            </Label>
          </div>
          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isAddingUser}
            >
              {isAddingUser ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding User...
                </span>
              ) : addUserSuccess ? (
                <span className="flex items-center justify-center">
                  <Check className="mr-2 h-4 w-4" /> User Added
                </span>
              ) : (
                'Add User'
              )}
            </Button>
          </div>
        </form>
        
        {users.length > 0 && (
          <div className="mt-6 p-4 border rounded-md bg-muted/30">
            <h3 className="font-medium mb-2">Existing Users:</h3>
            <ul className="list-disc pl-5">
              {users.map(user => (
                <li key={user.username} className={user.username === currentUsername ? 'font-bold' : ''}>
                  {user.username} {user.username === currentUsername && '(you)'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 