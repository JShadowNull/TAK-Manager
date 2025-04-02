import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/shadcn/card/card';
import { Button } from '@/components/shared/ui/shadcn/button';
import { UserMinus, User, Loader2, AlertTriangle, Shield, ShieldAlert, KeySquare } from 'lucide-react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { RemoveUserDialog } from './dialogs/RemoveUserDialog';
import { AdminStatusDialog } from './dialogs/AdminStatusDialog';
import { AdminPasswordResetDialog } from './dialogs/AdminPasswordResetDialog';

interface UserManagementProps {
  users: { username: string; is_admin: boolean }[];
  currentUsername: string;
  isLoadingUsers: boolean;
  onUserRemoved: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ 
  users, 
  currentUsername, 
  isLoadingUsers, 
  onUserRemoved 
}) => {
  // Dialog states
  const [showRemoveUserDialog, setShowRemoveUserDialog] = useState(false);
  const [showAdminStatusDialog, setShowAdminStatusDialog] = useState(false);
  const [showAdminPasswordResetDialog, setShowAdminPasswordResetDialog] = useState(false);
  
  // Selected user state
  const [selectedUser, setSelectedUser] = useState<{ username: string; is_admin: boolean } | null>(null);
  const [usernameToRemove, setUsernameToRemove] = useState('');
  const [newAdminStatus, setNewAdminStatus] = useState(false);
  
  // Open remove user dialog
  const openRemoveUserDialog = (username: string) => {
    setUsernameToRemove(username);
    setShowRemoveUserDialog(true);
  };
  
  // Open admin status dialog
  const openAdminStatusDialog = (user: { username: string; is_admin: boolean }) => {
    setSelectedUser(user);
    setNewAdminStatus(!user.is_admin);
    setShowAdminStatusDialog(true);
  };
  
  // Open admin password reset dialog
  const openAdminPasswordResetDialog = (user: { username: string; is_admin: boolean }) => {
    setSelectedUser(user);
    setShowAdminPasswordResetDialog(true);
  };

  return (
    <>
      <Card className="w-full max-w-1/3 mx-auto">
        <CardHeader>
          <div className="flex items-center">
            <UserMinus className="h-6 w-6 mr-2" />
            <CardTitle>Manage Users</CardTitle>
          </div>
          <CardDescription>
            Manage existing user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin h-6 w-6" />
              </div>
            ) : users.length <= 1 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
                <p className="text-muted-foreground">
                  At least one user account must exist in the system.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 p-4">
                    {users.map(user => (
                      <div 
                        key={user.username}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center">
                          <User className="h-5 w-5 mr-3 text-muted-foreground" />
                          <span className={user.username === currentUsername ? 'font-semibold' : ''}>
                            {user.username} {user.username === currentUsername && '(you)'}
                          </span>
                          {user.is_admin && (
                            <span className="ml-2 flex items-center text-primary">
                              <Shield className="h-4 w-4 mr-1" />
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {/* Admin operations buttons for other users */}
                          {user.username !== currentUsername && (
                            <>
                              <Button
                                variant="outline"
                                title={user.is_admin ? "Revoke admin privileges" : "Grant admin privileges"}
                                onClick={() => openAdminStatusDialog(user)}
                                className="flex items-center py-1 px-3 h-8 text-xs"
                              >
                                {user.is_admin ? (
                                  <>
                                    <ShieldAlert className="h-4 w-4 text-yellow-500 mr-1" />
                                    Revoke Admin
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-1" />
                                    Make Admin
                                  </>
                                )}
                              </Button>
                              
                              <Button
                                variant="outline"
                                title="Reset password"
                                onClick={() => openAdminPasswordResetDialog(user)}
                                className="flex items-center py-1 px-3 h-8 text-xs"
                              >
                                <KeySquare className="h-4 w-4 mr-1" />
                                Reset Password
                              </Button>
                              
                              <Button
                                variant="danger"
                                className="flex items-center py-1 px-3 h-8 text-xs"
                                onClick={() => openRemoveUserDialog(user.username)}
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RemoveUserDialog 
        open={showRemoveUserDialog}
        onOpenChange={setShowRemoveUserDialog}
        username={usernameToRemove}
        currentUsername={currentUsername}
        onSuccess={onUserRemoved}
      />
      
      <AdminStatusDialog 
        open={showAdminStatusDialog}
        onOpenChange={setShowAdminStatusDialog}
        user={selectedUser}
        newAdminStatus={newAdminStatus}
        onSuccess={onUserRemoved}
      />
      
      <AdminPasswordResetDialog 
        open={showAdminPasswordResetDialog}
        onOpenChange={setShowAdminPasswordResetDialog}
        user={selectedUser}
        onSuccess={onUserRemoved}
      />
    </>
  );
}; 