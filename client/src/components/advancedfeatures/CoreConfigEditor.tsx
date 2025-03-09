import React, { useState, useEffect } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/shadcn/card/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { RotateCcw, AlertCircle } from "lucide-react";
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTakServer } from '@/components/shared/ui/shadcn/sidebar/app-sidebar';
import { usePortManager } from './PortManager';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';

// Add interface for port confirmation dialog
interface PortConfirmDialogState {
  show: boolean;
  currentPorts: number[];
  portsToAdd: number[];
  portsToRemove: number[];
}

const CoreConfigEditor: React.FC = () => {
  const { toast } = useToast();
  const [xmlContent, setXmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isApplyingPortChanges, setIsApplyingPortChanges] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Add port confirmation dialog state
  const [portConfirmDialog, setPortConfirmDialog] = useState<PortConfirmDialogState>({
    show: false,
    currentPorts: [],
    portsToAdd: [],
    portsToRemove: []
  });

  // Initialize port manager hook
  const portManager = usePortManager(xmlContent);
  const { serverState } = useTakServer();

  useEffect(() => {
    fetchConfig(false);
  }, []);

  const handleRestart = async () => {
    if (isRestarting) return;
    
    setIsRestarting(true);
    
    try {
      const response = await fetch('/api/takserver/restart-takserver', { method: 'POST' });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to restart server');
      }
      
      showToast('Success', 'TAK Server restarted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      showToast('Error', `Failed to restart TAK Server: ${errorMessage}`, 'destructive');
    } finally {
      setIsRestarting(false);
    }
  };

  const showToast = (title: string, message: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description: message,
      variant
    });
  };

  const fetchConfig = async (isReset = false) => {
    // Use appropriate loading state based on whether this is initial load or reset
    if (isReset) {
      setIsResetting(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const response = await fetch('/api/advanced/core-config');
      const data = await response.json();
      
      if (response.ok) {
        setXmlContent(data.content);
        if (isReset) {
          showToast('Success', 'Configuration reset successfully');
        }
      } else {
        throw new Error(data.error || data.detail || 'Failed to fetch configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast('Error', `Failed to load configuration: ${errorMessage}`, 'destructive');
    } finally {
      if (isReset) {
        setIsResetting(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const validateConfig = async (content: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/advanced/core-config/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        showToast('Validation Error', errorData.detail || 'Invalid configuration', 'destructive');
        return false;
      }
      
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast('Validation Error', errorMessage, 'destructive');
      return false;
    }
  };

  const handleReset = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    fetchConfig(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // Validate the configuration
      const isValid = await validateConfig(xmlContent);
      
      if (!isValid) {
        showToast('Invalid Configuration', 'The configuration is invalid and cannot be saved.', 'destructive');
        setIsSaving(false);
        return;
      }
      
      // Make a deterministic check for port changes right before saving
      // This returns the actual port changes without relying on timeouts or debouncing
      const portChanges = await portManager.checkPortChanges(false);
      
      // If there are port changes, show the confirmation dialog
      if (portChanges.portsToAdd.length > 0 || portChanges.portsToRemove.length > 0) {
        // Get current ports for the dialog
        const currentPorts = await fetchCurrentPorts();
        
        // Show the confirmation dialog
        setPortConfirmDialog({
          show: true,
          currentPorts,
          portsToAdd: portChanges.portsToAdd,
          portsToRemove: portChanges.portsToRemove
        });
        
        setIsSaving(false);
        return;
      }
      
      // No port changes, save directly
      await saveConfiguration();
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      showToast(
        'Error',
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'destructive'
      );
      setIsSaving(false);
    }
  };
  
  // Create new function to handle actual saving
  const saveConfiguration = async (applyPortChanges = false) => {
    if (applyPortChanges) {
      setIsApplyingPortChanges(true);
    } else {
      setIsSaving(true);
    }
    
    try {
      // Save the configuration first - ensure the endpoint is correct
      const response = await fetch('/api/advanced/core-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: xmlContent }),
      });
      
      const data = await response.json();
      if (response.ok) {
        // Apply port changes if requested
        if (applyPortChanges) {
          try {
            await portManager.applyChanges();
            showToast(
              'Success', 
              'Configuration saved and port changes applied. Restart the server for changes to take effect.'
            );
          } catch (error) {
            // If port changes fail, still notify about config save but mention port issue
            showToast(
              'Partial Success', 
              'Configuration saved successfully, but failed to update docker port mappings.'
            );
          }
        } else {
          showToast('Success', 'Configuration saved successfully');
        }
        
        // Refresh the configuration after saving to ensure everything is in sync
        await fetchConfig(false);
      } else {
        throw new Error(data.error || data.detail || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      showToast(
        'Error',
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'destructive'
      );
    } finally {
      if (applyPortChanges) {
        setIsApplyingPortChanges(false);
      } else {
        setIsSaving(false);
      }
      // Close dialog if it was open
      setPortConfirmDialog(prev => ({ ...prev, show: false }));
    }
  };
  
  // New function to handle port confirmation
  const handlePortConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      // Save with port changes
      saveConfiguration(true);
    } else {
      // Just close the dialog
      setPortConfirmDialog(prev => ({ ...prev, show: false }));
    }
  };
  
  // Helper function to fetch current ports
  const fetchCurrentPorts = async (): Promise<number[]> => {
    try {
      const response = await fetch('/api/port-manager/ports');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ports: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.port_mappings) {
        // Extract host ports from port mappings (format: "host_port:container_port")
        return data.port_mappings.map((mapping: string) => {
          const [hostPort] = mapping.split(':');
          return parseInt(hostPort, 10);
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching current ports:', error);
      return [];
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <CardTitle>Core Configuration Editor</CardTitle>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {serverState.isRunning ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  )}
                </span>
                <span className={`text-sm ${serverState.isRunning ? 'text-green-500' : 'text-red-500'}`}>
                  {serverState.isRunning ? 'TAK Server Running' : 'TAK Server Not Running'}
                </span>
              </div>
            </div>
            {serverState.isRunning && (
              <Button
              variant="outline"
              onClick={handleRestart}
              disabled={isRestarting}
              loading={isRestarting}
              loadingText="Restarting..."
              leadingIcon={<RotateCcw className="h-4 w-4" />}
              className="w-full lg:w-auto mt-4 lg:mt-0"
            >
              Restart TAK Server
            </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-[600px] border rounded-md overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">Loading...</span>
              </div>
              ) : (
                <CodeMirror
                  value={xmlContent}
                  height="600px"
                  theme={oneDark}
                  extensions={[xml(), EditorView.lineWrapping, EditorState.allowMultipleSelections.of(true)]}
                  onChange={(value) => setXmlContent(value)}
                />
              )}
            </div>
            <div className="flex flex-col lg:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isResetting || isLoading}
                loading={isResetting}
                loadingText="Resetting..."
                className="w-full lg:w-auto"
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                loading={isSaving}
                loadingText="Saving..."
                className="w-full lg:w-auto"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Port Changes Confirmation Dialog */}
      <Dialog open={portConfirmDialog.show} onOpenChange={(open) => setPortConfirmDialog(prev => ({ ...prev, show: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Port Configuration Changes
            </DialogTitle>
            <DialogDescription>
              Your changes will modify the following port mappings in the Docker configuration:
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
              Do you want to save the configuration and apply these port changes?
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
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoreConfigEditor; 