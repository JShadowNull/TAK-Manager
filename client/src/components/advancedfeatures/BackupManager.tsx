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
  AlertCircle,
  CheckCircle,
  Lock,
  FileText,
} from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

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

const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBackupName, setNewBackupName] = useState('');
  const [selectedBackupContent, setSelectedBackupContent] = useState('');
  const [dialog, setDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'notification'
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
      showNotification('Error', `Failed to fetch backups: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBackups();
  }, []);

  const showNotification = (title: string, message: string, type: DialogState['type']) => {
    setDialog({ show: true, title, message, type });
  };

  const handleCreateBackup = async () => {
    try {
      const response = await fetch('/api/advanced/core-config/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newBackupName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create backup');
      }

      showNotification('Success', 'Backup created successfully', 'notification');
      setNewBackupName('');
      fetchBackups();
    } catch (error) {
      showNotification('Error', `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    try {
      const response = await fetch('/api/advanced/core-config/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backup_id: backupId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to restore backup');
      }

      showNotification('Success', 'Configuration restored successfully', 'notification');
      fetchBackups();
    } catch (error) {
      showNotification('Error', `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/advanced/core-config/backups/${backupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete backup');
      }

      showNotification('Success', 'Backup deleted successfully', 'notification');
      fetchBackups();
    } catch (error) {
      showNotification('Error', `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    }
  };

  const fetchBackupContent = async (backupId: string) => {
    try {
      const response = await fetch(`/api/advanced/core-config/backups/${backupId}/content`);
      const data = await response.json();
      
      if (response.ok) {
        setSelectedBackupContent(data.content);
      } else {
        throw new Error(data.detail || 'Failed to fetch backup content');
      }
    } catch (error) {
      showNotification('Error', `Failed to fetch backup content: ${error instanceof Error ? error.message : 'Unknown error'}`, 'notification');
    }
  };

  const handleViewBackup = async (backupId: string, name: string) => {
    await fetchBackupContent(backupId);
    setDialog({
      show: true,
      title: `Viewing Backup: ${name}`,
      message: '',
      type: 'view',
      backupId
    });
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
                placeholder="Backup name (optional)"
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
                          >
                            <FileText className="h-4 w-4" />
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
                          >
                            <RotateCcw className="h-4 w-4" />
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
                            >
                              <Trash2 className="h-4 w-4" />
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
    </>
  );
};

export default BackupManager; 