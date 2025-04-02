import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/shadcn/card/card';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from '@/components/shared/ui/shadcn/label';
import { useAuth } from '@/utils/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/shadcn/tabs';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { UserPlus, UserMinus, KeyRound, User } from 'lucide-react';
import axios from 'axios';

export const Profile: React.FC = () => {
  const { username } = useAuth();
  const { toast } = useToast();
  
  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // User management state
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // User removal state
  const [usernameToRemove, setUsernameToRemove] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isRemovingUser, setIsRemovingUser] = useState(false);
  
  // User listing state
  const [users, setUsers] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Current tab state
  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('profileTab') || 'reset-password';
  });

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('profileTab', currentTab);
  }, [currentTab]);
  
  // Load user list
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await axios.get('/api/auth/users');
      setUsers(response.data.users || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load user list",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Reset password handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    setIsResettingPassword(true);
    try {
      await axios.post('/api/auth/reset-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      toast({
        title: "Success",
        description: "Password has been successfully updated",
      });
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password. Please check your current password.",
        variant: "destructive"
      });
    } finally {
      setIsResettingPassword(false);
    }
  };
  
  // Add user handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUsername || !newUserPassword) {
      toast({
        title: "Error",
        description: "Username and password are required",
        variant: "destructive"
      });
      return;
    }
    
    setIsAddingUser(true);
    try {
      await axios.post('/api/auth/add-user', {
        username: newUsername,
        password: newUserPassword
      });
      
      toast({
        title: "Success",
        description: `User "${newUsername}" has been added`,
      });
      
      // Clear form and refresh user list
      setNewUsername('');
      setNewUserPassword('');
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add user. The username may already exist.",
        variant: "destructive"
      });
    } finally {
      setIsAddingUser(false);
    }
  };
  
  // Remove user handler
  const handleRemoveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!usernameToRemove || !adminPassword) {
      toast({
        title: "Error",
        description: "Username to remove and your password are required",
        variant: "destructive"
      });
      return;
    }
    
    if (usernameToRemove === username) {
      toast({
        title: "Error",
        description: "You cannot remove your own account",
        variant: "destructive"
      });
      return;
    }
    
    setIsRemovingUser(true);
    try {
      await axios.post('/api/auth/remove-user', {
        username: usernameToRemove,
        admin_password: adminPassword
      });
      
      toast({
        title: "Success",
        description: `User "${usernameToRemove}" has been removed`,
      });
      
      // Clear form and refresh user list
      setUsernameToRemove('');
      setAdminPassword('');
      loadUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove user. Please check your password and the username.",
        variant: "destructive"
      });
    } finally {
      setIsRemovingUser(false);
    }
  };

  return (
    <div className="bg-background text-foreground pt-4">
      <div className="mx-auto space-y-8">
        {/* Account Information Card - Always visible */}
        <Card className="max-w-6xl mx-auto">
          <CardHeader>
            <div className="flex items-center">
              <User className="h-6 w-6 mr-2" />
              <CardTitle>Account Information</CardTitle>
            </div>
            <CardDescription>
              Your account details and information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <div className="text-lg font-semibold mt-1">{username}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for additional functionality */}
        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-muted flex-wrap h-auto w-auto">
              <TabsTrigger 
                value="reset-password" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Reset Password
              </TabsTrigger>
              <TabsTrigger 
                value="add-user" 
                onClick={loadUsers}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Add User
              </TabsTrigger>
              <TabsTrigger 
                value="remove-user" 
                onClick={loadUsers}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Remove User
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="reset-password" className="w-full">
              <Card className="max-w-6xl mx-auto">
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
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input 
                        id="new-password" 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input 
                        id="confirm-password" 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword ? 'Updating...' : 'Reset Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="add-user" className="w-full">
              <Card className="max-w-6xl mx-auto">
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
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-password">Password</Label>
                      <Input 
                        id="new-user-password" 
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isAddingUser}
                    >
                      {isAddingUser ? 'Adding User...' : 'Add User'}
                    </Button>
                  </form>
                  
                  {users.length > 0 && (
                    <div className="mt-6 p-4 border rounded-md bg-muted/30">
                      <h3 className="font-medium mb-2">Existing Users:</h3>
                      <ul className="list-disc pl-5">
                        {users.map(user => (
                          <li key={user} className={user === username ? 'font-bold' : ''}>
                            {user} {user === username && '(you)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="remove-user" className="w-full">
              <Card className="max-w-6xl mx-auto">
                <CardHeader>
                  <div className="flex items-center">
                    <UserMinus className="h-6 w-6 mr-2" />
                    <CardTitle>Remove User</CardTitle>
                  </div>
                  <CardDescription>
                    Remove an existing user account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRemoveUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username-to-remove">Username to Remove</Label>
                      <Input 
                        id="username-to-remove" 
                        value={usernameToRemove}
                        onChange={(e) => setUsernameToRemove(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Your Password</Label>
                      <Input 
                        id="admin-password" 
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-red-600 hover:bg-red-700"
                      disabled={isRemovingUser}
                    >
                      {isRemovingUser ? 'Removing User...' : 'Remove User'}
                    </Button>
                  </form>
                  
                  {users.length > 0 && (
                    <div className="mt-6 p-4 border rounded-md bg-muted/30">
                      <h3 className="font-medium mb-2">Existing Users:</h3>
                      <ul className="list-disc pl-5">
                        {users.map(user => (
                          <li key={user} className={user === username ? 'font-bold' : ''}>
                            {user} {user === username && '(you)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile; 