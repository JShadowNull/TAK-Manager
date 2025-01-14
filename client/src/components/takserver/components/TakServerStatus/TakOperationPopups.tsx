import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui/shadcn/dialog';
import { Progress } from '../../../shared/ui/shadcn/progress';
import { Button } from '../../../shared/ui/shadcn/button';
import { ScrollArea } from '../../../shared/ui/shadcn/scroll-area';

interface TerminalLine {
  message: string;
  isError: boolean;
  timestamp: number;
}

interface PopupsProps {
  showUninstallConfirm: boolean;
  onUninstallConfirmClose: () => void;
  onUninstallConfirm: () => void;
  onInstallComplete: () => void;
  onUninstallComplete: () => void;
  showInstallProgress?: boolean;
  showUninstallProgress?: boolean;
}

const Popups: React.FC<PopupsProps> = ({
  showUninstallConfirm,
  onUninstallConfirmClose,
  onUninstallConfirm,
  onInstallComplete,
  onUninstallComplete,
  showInstallProgress = false,
  showUninstallProgress: externalShowUninstallProgress = false
}) => {
  // Installation state
  const [showInstallComplete, setShowInstallComplete] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState<string>();
  const [installTerminalOutput, setInstallTerminalOutput] = useState<TerminalLine[]>([]);
  const [isInstallationComplete, setIsInstallationComplete] = useState(false);

  // Uninstall state
  const [showUninstallComplete, setShowUninstallComplete] = useState(false);
  const [uninstallProgress, setUninstallProgress] = useState(0);
  const [uninstallError, setUninstallError] = useState<string>();
  const [uninstallTerminalOutput, setUninstallTerminalOutput] = useState<TerminalLine[]>([]);
  const [isUninstallationComplete, setIsUninstallationComplete] = useState(false);

  // Debug logging for state changes
  useEffect(() => {
    console.debug(`[Popups] Install Progress Dialog - showInstallProgress: ${showInstallProgress}, showInstallComplete: ${showInstallComplete}`);
  }, [showInstallProgress, showInstallComplete]);

  useEffect(() => {
    console.debug(`[Popups] Install Complete Dialog - showInstallComplete: ${showInstallComplete}, error: ${installError ? 'true' : 'false'}`);
  }, [showInstallComplete, installError]);

  useEffect(() => {
    console.debug(`[Popups] Uninstall Progress Dialog - showUninstallProgress: ${externalShowUninstallProgress}, showUninstallComplete: ${showUninstallComplete}`);
  }, [externalShowUninstallProgress, showUninstallComplete]);

  useEffect(() => {
    console.debug(`[Popups] Uninstall Complete Dialog - showUninstallComplete: ${showUninstallComplete}, error: ${uninstallError ? 'true' : 'false'}`);
  }, [showUninstallComplete, uninstallError]);

  // Installation status stream
  useEffect(() => {
    if (!showInstallProgress) {
      console.debug('[Popups] Install status stream - Not starting because showInstallProgress is false');
      return;
    }

    // Clear any previous state when starting a new installation
    setInstallError(undefined);
    setInstallProgress(0);
    setInstallTerminalOutput([]);
    setShowInstallComplete(false);
    setIsInstallationComplete(false);

    console.debug('[Popups] Install status stream - Starting EventSource connection');
    const installStatus = new EventSource('/api/takserver/install-status-stream');
    installStatus.addEventListener('install-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.debug('[Popups] Install status event received:', data);
        if (data.type === 'terminal') {
          setInstallTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
            timestamp: data.timestamp
          }]);
        } else {
          setInstallProgress(data.progress);
          if (data.error) {
            console.debug('[Popups] Install error received:', data.error);
            setInstallError(data.error);
            // Don't auto-close on error, let user review and close manually
            setIsInstallationComplete(true);
          }
          if (data.status === 'complete') {
            console.debug('[Popups] Install complete status received');
            // Don't auto-close on completion, let user review and close manually
            setIsInstallationComplete(true);
          }
        }
      } catch (error) {
        console.error('[Popups] Error parsing install status:', error);
      }
    });

    return () => {
      // Only close the connection if installation is complete AND user has acknowledged
      if (isInstallationComplete && showInstallComplete) {
        console.debug('[Popups] Install status stream - Closing EventSource connection');
        installStatus.close();
      }
    };
  }, [showInstallProgress]);

  // Uninstall status stream
  useEffect(() => {
    if (!externalShowUninstallProgress) {
      console.debug('[Popups] Uninstall status stream - Not starting because showUninstallProgress is false');
      return;
    }

    // Clear any previous state when starting a new uninstallation
    setUninstallError(undefined);
    setUninstallProgress(0);
    setUninstallTerminalOutput([]);
    setShowUninstallComplete(false);
    setIsUninstallationComplete(false);

    console.debug('[Popups] Uninstall status stream - Starting EventSource connection');
    const uninstallStatus = new EventSource('/api/takserver/uninstall-status-stream');
    uninstallStatus.addEventListener('uninstall-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.debug('[Popups] Uninstall status event received:', data);
        if (data.type === 'terminal') {
          setUninstallTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
            timestamp: data.timestamp
          }]);
        } else if (data.type === 'status') {
          setUninstallProgress(data.progress);
          if (data.error) {
            console.debug('[Popups] Uninstall error received:', data.error);
            setUninstallError(data.error);
            setIsUninstallationComplete(true);
          }
          if (data.status === 'complete') {
            console.debug('[Popups] Uninstall complete status received');
            setIsUninstallationComplete(true);
          }
        }
      } catch (error) {
        console.error('[Popups] Error parsing uninstall status:', error);
      }
    });

    return () => {
      if (isUninstallationComplete && showUninstallComplete) {
        console.debug('[Popups] Uninstall status stream - Closing EventSource connection');
        uninstallStatus.close();
      }
    };
  }, [externalShowUninstallProgress]);

  const handleUninstall = async () => {
    try {
      console.debug('[Popups] Starting uninstall process');
      onUninstallConfirm();
      setUninstallProgress(0);
      setUninstallError(undefined);
      setUninstallTerminalOutput([]);

      const response = await fetch('/api/takserver/uninstall-takserver', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Uninstallation failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[Popups] Uninstallation error:', error);
      setUninstallError(error instanceof Error ? error.message : 'Uninstallation failed');
    }
  };

  const resetInstallState = () => {
    console.debug('[Popups] Resetting install state');
    setShowInstallComplete(false);
    setInstallProgress(0);
    setInstallError(undefined);
    setInstallTerminalOutput([]);
    setIsInstallationComplete(true); // Ensure we mark it as complete before closing
    onInstallComplete();
  };

  const resetUninstallState = () => {
    console.debug('[Popups] Resetting uninstall state');
    setShowUninstallComplete(false);
    setUninstallProgress(0);
    setUninstallError(undefined);
    setUninstallTerminalOutput([]);
    setIsUninstallationComplete(true); // Ensure we mark it as complete before closing
    onUninstallComplete();
  };

  return (
    <>
      {/* Installation Progress Dialog */}
      <Dialog 
        open={showInstallProgress && !showInstallComplete} 
        onOpenChange={(open) => {
          // Prevent dialog from being closed except through explicit user action
          if (!open) {
            return;
          }
        }}
      >
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="xl:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Installing TAK Server</DialogTitle>
            <DialogDescription>
              {installProgress === 100 
                ? "Installation complete. Review the logs and click Next to continue." 
                : "Please wait while TAK Server is being installed..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress 
              value={installProgress}
              isIndeterminate={installProgress === 0}
              text={installProgress === 0 
                ? "Initializing..." 
                : `Progress: ${installProgress}%`
              }
            />
            {installTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background"
                content={installTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {installTerminalOutput.map((line, index) => (
                    <div key={index}>
                      <div className={`font-mono text-sm whitespace-pre-wrap ${line.isError ? 'text-destructive' : 'text-foreground'}`}>
                        {line.timestamp && (
                          <span className="text-muted-foreground mr-2">
                            {new Date(line.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                        {line.message}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            {isInstallationComplete && (
              <Button onClick={() => setShowInstallComplete(true)}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Installation Complete Dialog */}
      <Dialog open={showInstallComplete}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {installError ? "Installation Failed" : "Installation Complete"}
            </DialogTitle>
            <DialogDescription>
              {installError ? installError : "TAK Server has been successfully installed! You can now enjoy TAK features."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetInstallState}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Confirmation Dialog */}
      <Dialog open={showUninstallConfirm}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Confirm Uninstall</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall TAK Server? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onUninstallConfirmClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleUninstall}>
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Progress Dialog */}
      <Dialog 
        open={externalShowUninstallProgress && !showUninstallComplete} 
        onOpenChange={(open) => {
          // Prevent dialog from being closed except through explicit user action
          if (!open) {
            return;
          }
        }}
      >
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="xl:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Uninstalling TAK Server</DialogTitle>
            <DialogDescription>
              {uninstallProgress === 100 
                ? "Uninstallation complete. Review the logs and click Next to continue." 
                : "Please wait while TAK Server is being uninstalled..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress 
              value={uninstallProgress}
              isIndeterminate={uninstallProgress === 0}
              text={uninstallProgress === 0 
                ? "Initializing..." 
                : `Progress: ${uninstallProgress}%`
              }
            />
            {uninstallTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background"
                content={uninstallTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {uninstallTerminalOutput.map((line, index) => (
                    <div key={index}>
                      <div className={`font-mono text-sm whitespace-pre-wrap ${line.isError ? 'text-destructive' : 'text-foreground'}`}>
                        {line.timestamp && (
                          <span className="text-muted-foreground mr-2">
                            {new Date(line.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                        {line.message}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            {isUninstallationComplete && (
              <Button onClick={() => setShowUninstallComplete(true)}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Complete Dialog */}
      <Dialog open={showUninstallComplete}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {uninstallError ? "Uninstallation Failed" : "Uninstallation Complete"}
            </DialogTitle>
            <DialogDescription>
              {uninstallError ? uninstallError : "TAK Server has been successfully uninstalled!"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetUninstallState}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Popups; 