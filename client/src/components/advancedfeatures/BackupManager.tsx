import React, { useState, useEffect } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/shadcn/card/card";
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Input } from "@/components/shared/ui/shadcn/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import {
  RotateCcw,
  Trash2,
  History,
  Plus,
  CheckCircle,
  Lock,
  FileText,
} from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { extractPortsFromXml, applyPortChanges, detectPortChanges, fetchCurrentPorts, PortChange } from './PortManager';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { AlertCircle } from "lucide-react";

interface Backup {
  id: string;
  name: string;
  timestamp: string;
  path: string;
  isInit: boolean;
}

interface DialogState {
  show: boolean;
  title: string;
  message: string;
  type: 'create' | 'restore' | 'delete' | 'notification' | 'view';
  backupId?: string;
}

interface PortConfirmDialogState {
  show: boolean;
  backupId: string;
  currentPorts: number[];
  portsToAdd: number[];
  portsToRemove: number[];
  backupContent: string;
}

const BackupManager: React.FC = () => {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [isDeletingBackup, setIsDeletingBackup] = useState<string | null>(null);
  const [isViewingBackup, setIsViewingBackup] = useState<string | null>(null);
  const [isApplyingPortChanges, setIsApplyingPortChanges] = useState(false);
  const [newBackupName, setNewBackupName] = useState('');
  const [selectedBackupContent, setSelectedBackupContent] = useState('');
  const [dialog, setDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'notification'
  });
  const [portConfirmDialog, setPortConfirmDialog] = useState<PortConfirmDialogState>({
    show: false,
    backupId: '',
    currentPorts: [],
    portsToAdd: [],
    portsToRemove: [],
    backupContent: '',
  });

  // Fetch backups
  const fetchBackups = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/advanced/core-config/backups');
      const data = await response.json();
      
      if (response.ok) {
        setBackups(data.backups);
      } else {
        throw new Error(data.detail || 'Failed to fetch backups');
      }
    } catch (error) {
      showToast('Error', `Failed to fetch backups: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBackups();
  }, []);

  const showToast = (title: string, message: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description: message,
      variant
    });
  };

  const handleCreateBackup = async () => {
    if (!newBackupName.trim()) {
      showToast('Error', 'Backup name cannot be empty', 'destructive');
      return;
    }
    
    setIsCreatingBackup(true);
    
    try {
      const response = await fetch('/api/advanced/core-config/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newBackupName.trim() }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Success', 'Backup created successfully');
        setNewBackupName('');
        // Refresh backups list
        fetchBackups();
      } else {
        throw new Error(data.error || data.detail || 'Failed to create backup');
      }
    } catch (error) {
      showToast('Error', `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    try {
      setIsRestoringBackup(true);
      
      // Fetch the backup content to check for port changes
      const backupContent = await fetchBackupContent(backupId);
      
      // Check for port changes
      const portChanges = await checkPortChangesForBackup(backupContent);
      
      // If there are port changes, show the confirmation dialog
      if (portChanges.portsToAdd.length > 0 || portChanges.portsToRemove.length > 0) {
        // Get current ports for the dialog
        const currentPorts = await fetchCurrentPorts();
        
        // Show the confirmation dialog
        setPortConfirmDialog({
          show: true,
          backupId,
          currentPorts,
          portsToAdd: portChanges.portsToAdd,
          portsToRemove: portChanges.portsToRemove,
          backupContent
        });
        setIsRestoringBackup(false);
        return;
      }
      
      await restoreBackupWithoutPortChanges(backupId);
    } catch (error) {
      showToast('Error', `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
      setIsRestoringBackup(false);
    }
  };

  const handlePortConfirmation = async (confirmed: boolean) => {
    const { backupId, portsToAdd, portsToRemove } = portConfirmDialog;
    
    setPortConfirmDialog(prev => ({ ...prev, show: false }));
    
    if (!confirmed) {
      return;
    }
    
    try {
      setIsApplyingPortChanges(true);
      await restoreBackupWithoutPortChanges(backupId);
      
      await applyPortChanges({ portsToAdd, portsToRemove });
      
      showToast('Success', 'Configuration and port mappings restored successfully');
    } catch (error) {
      showToast('Error', `Failed to restore backup with port changes: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
    } finally {
      setIsApplyingPortChanges(false);
    }
  };

  const restoreBackupWithoutPortChanges = async (backupId: string) => {
    try {
      const restoreResponse = await fetch('/api/advanced/core-config/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backup_id: backupId }),
      });
      
      if (!restoreResponse.ok) {
        const data = await restoreResponse.json();
        throw new Error(data.detail || 'Failed to restore backup');
      }
      
      showToast('Success', 'Configuration restored successfully');
      
      // Refresh backups list to update the "current" indicator
      fetchBackups();
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      setIsDeletingBackup(backupId);
      
      const response = await fetch(`/api/advanced/core-config/backups/${backupId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete backup');
      }
      
      showToast('Success', 'Backup deleted successfully');
      fetchBackups();
    } catch (error) {
      showToast('Error', `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
    } finally {
      setIsDeletingBackup(null);
    }
  };

  // Helper function to check port changes for a backup
  const checkPortChangesForBackup = async (backupContent: string): Promise<PortChange> => {
    // Extract ports from backup content
    const backupPorts = extractPortsFromXml(backupContent);
    
    // Get current ports
    const currentPorts = await fetchCurrentPorts();
    
    // Detect changes
    return detectPortChanges(backupPorts, currentPorts);
  };

  const fetchBackupContent = async (backupId: string): Promise<string> => {
    const contentResponse = await fetch(`/api/advanced/core-config/backups/${backupId}/content`);
    
    if (!contentResponse.ok) {
      const data = await contentResponse.json();
      throw new Error(data.detail || 'Failed to fetch backup content');
    }
    
    const contentData = await contentResponse.json();
    const content = contentData.content || '';
    
    return content;
  };

  const handleViewBackup = async (backupId: string, name: string) => {
    try {
      setIsViewingBackup(backupId);
      
      const content = await fetchBackupContent(backupId);
      setSelectedBackupContent(content);
      
      setDialog({
        show: true,
        title: `Viewing Backup: ${name}`,
        message: '',
        type: 'view'
      });
    } catch (error) {
      showToast('Error', `Failed to fetch backup content: ${error instanceof Error ? error.message : 'Unknown error'}`, 'destructive');
    } finally {
      setIsViewingBackup(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(
      parseInt(timestamp.substring(0, 4)),
      parseInt(timestamp.substring(4, 6)) - 1,
      parseInt(timestamp.substring(6, 8)),
      parseInt(timestamp.substring(9, 11)),
      parseInt(timestamp.substring(11, 13)),
      parseInt(timestamp.substring(13, 15))
    );
    return date.toLocaleString();
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Backup Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Backup name"
                value={newBackupName}
                onChange={(e) => setNewBackupName(e.target.value)}
                className="w-1/2 lg:w-auto"
              />
              <Button
                onClick={() => setDialog({
                  show: true,
                  title: 'Create Backup',
                  message: 'Are you sure you want to create a new backup?',
                  type: 'create'
                })}
                className="whitespace-nowrap"
                leadingIcon={<Plus/>}
                loading={isCreatingBackup}
                loadingText="Creating..."
                disabled={isCreatingBackup}
              >
                Create Backup
              </Button>
            </div>

            <div className="border rounded-lg">
              <ScrollArea className="h-fit lg:h-[400px]">
                <div className="p-4 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Loading backups...
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No backups found
                    </div>
                  ) : (
                    backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {backup.isInit && <Lock className="h-4 w-4 text-red-500 dark:text-red-600" />}
                          <div>
                            <div className="font-medium">{backup.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatTimestamp(backup.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleViewBackup(backup.id, backup.name)}
                            className="hover:text-blue-500 dark:hover:text-blue-600"
                            loading={isViewingBackup === backup.id}
                            disabled={isViewingBackup !== null}
                          >
                            {isViewingBackup !== backup.id && <FileText className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDialog({
                              show: true,
                              title: 'Restore Backup',
                              message: `Are you sure you want to restore the backup "${backup.name}"? This will overwrite the current configuration.`,
                              type: 'restore',
                              backupId: backup.id
                            })}
                            className="hover:text-blue-500 dark:hover:text-blue-600"
                            loading={isRestoringBackup}
                            disabled={isRestoringBackup || isViewingBackup !== null || isDeletingBackup !== null}
                          >
                            {!isRestoringBackup && <RotateCcw className="h-4 w-4" />}
                          </Button>
                          {!backup.isInit && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setDialog({
                                show: true,
                                title: 'Delete Backup',
                                message: `Are you sure you want to delete the backup "${backup.name}"?`,
                                type: 'delete',
                                backupId: backup.id
                              })}
                              className="hover:text-red-500"
                              loading={isDeletingBackup === backup.id}
                              disabled={isDeletingBackup !== null || isRestoringBackup || isViewingBackup !== null}
                            >
                              {isDeletingBackup !== backup.id && <Trash2 className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialog.show} onOpenChange={(open) => setDialog(prev => ({ ...prev, show: open }))}>
        <DialogContent className={dialog.type === 'view' ? 'sm:max-w-4xl' : 'sm:max-w-md'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog.type === 'notification' && (
                dialog.title.toLowerCase().includes('error') ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )
              )}
              {dialog.title}
            </DialogTitle>
            {dialog.message && (
              <DialogDescription>
                {dialog.message}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {dialog.type === 'view' && (
            <div className="border rounded-md overflow-hidden">
              <CodeMirror
                value={selectedBackupContent}
                height="500px"
                theme={oneDark}
                extensions={[xml(), EditorView.lineWrapping]}
                readOnly={true}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                }}
              />
            </div>
          )}

          {dialog.type !== 'notification' && (
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialog(prev => ({ ...prev, show: false }))}
              >
                {dialog.type === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {dialog.type !== 'view' && (
                <Button
                  variant={dialog.type === 'delete' ? 'danger' : 'primary'}
                  onClick={() => {
                    if (dialog.type === 'create') {
                      handleCreateBackup();
                    } else if (dialog.type === 'restore' && dialog.backupId) {
                      handleRestoreBackup(dialog.backupId);
                    } else if (dialog.type === 'delete' && dialog.backupId) {
                      handleDeleteBackup(dialog.backupId);
                    }
                    setDialog(prev => ({ ...prev, show: false }));
                  }}
                  loading={
                    (dialog.type === 'create' && isCreatingBackup) ||
                    (dialog.type === 'restore' && isRestoringBackup) ||
                    (dialog.type === 'delete' && dialog.backupId && isDeletingBackup === dialog.backupId) ||
                    false
                  }
                  loadingText={
                    dialog.type === 'create' ? 'Creating...' :
                    dialog.type === 'restore' ? 'Restoring...' :
                    dialog.type === 'delete' ? 'Deleting...' : 'Processing...'
                  }
                >
                  {dialog.type === 'create' ? 'Create' : 
                   dialog.type === 'restore' ? 'Restore' : 
                   dialog.type === 'delete' ? 'Delete' : 'Confirm'}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={portConfirmDialog.show} onOpenChange={(open) => setPortConfirmDialog(prev => ({ ...prev, show: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Port Configuration Changes
            </DialogTitle>
            <DialogDescription>
              Restoring this backup will modify the following port mappings in the Docker configuration:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {portConfirmDialog.currentPorts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Current Ports:</h4>
                <div className="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {portConfirmDialog.currentPorts.join(', ')}
                </div>
              </div>
            )}

            {portConfirmDialog.portsToAdd.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-green-600">Ports to Add:</h4>
                <div className="text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-600">
                  {portConfirmDialog.portsToAdd.join(', ')}
                </div>
              </div>
            )}

            {portConfirmDialog.portsToRemove.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-red-600">Ports to Remove:</h4>
                <div className="text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600">
                  {portConfirmDialog.portsToRemove.join(', ')}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-4">
              Do you want to restore this backup and apply these port changes?
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => handlePortConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handlePortConfirmation(true)}
              loading={isApplyingPortChanges}
              loadingText="Applying Changes..."
            >
              Restore with Port Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BackupManager; 