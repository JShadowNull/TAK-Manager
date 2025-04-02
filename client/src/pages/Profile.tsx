import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/shadcn/card/card';
import { useAuth } from '@/utils/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/ui/shadcn/tabs';
import { User } from 'lucide-react';
import axios from 'axios';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { PasswordReset } from '@/components/auth/PasswordReset';
import { UserAddForm } from '@/components/auth/UserAddForm';
import { UserManagement } from '@/components/auth/UserManagement';
import { User as UserType } from '@/components/auth/types';

export const Profile: React.FC = () => {
  const { username } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // User listing state
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Current tab state
  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('profileTab') || 'reset-password';
  });

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('profileTab', currentTab);
  }, [currentTab]);
  
  // Fetch current user's admin status
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await axios.get('/api/auth/me');
        setIsAdmin(response.data.is_admin || false);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        toast({
          title: "Error",
          description: "Failed to fetch user information",
          variant: "destructive"
        });
      }
    };
    
    fetchUserInfo();
  }, [toast]);
  
  // Load user list
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      console.log("Fetching users from API...");
      const response = await axios.get('/api/auth/users');
      console.log("API response:", response.data);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "Failed to load user list",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load users when tab changes
  useEffect(() => {
    if (currentTab === 'add-user' || currentTab === 'remove-user') {
      loadUsers();
    }
  }, [currentTab]);

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
                  <label className="text-sm font-medium">Username</label>
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
              {isAdmin && (
                <>
                  <TabsTrigger 
                    value="add-user" 
                    onClick={() => loadUsers()}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
                  >
                    Add User
                  </TabsTrigger>
                  <TabsTrigger 
                    value="remove-user" 
                    onClick={() => loadUsers()}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
                  >
                    Manage Users
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="reset-password" className="w-full">
              <PasswordReset />
            </TabsContent>
            
            <TabsContent value="add-user" className="w-full">
              <UserAddForm 
                users={users} 
                currentUsername={username || ''}
                onUserAdded={loadUsers}
              />
            </TabsContent>
            
            <TabsContent value="remove-user" className="w-full">
              <UserManagement 
                users={users}
                currentUsername={username || ''}
                isLoadingUsers={isLoadingUsers}
                onUserRemoved={loadUsers}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile; 