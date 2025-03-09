import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui/shadcn/dialog';
import { Progress } from '../../../shared/ui/shadcn/progress';
import { Button } from '../../../shared/ui/shadcn/button';
import { ScrollArea } from '../../../shared/ui/shadcn/scroll-area';

interface TerminalLine {
  message: string;
  isError: boolean;
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
  showUninstallProgress = false
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

  // Installation status stream
  useEffect(() => {
    if (!showInstallProgress) {
      return;
    }

    // Clear any previous state when starting a new installation
    setInstallError(undefined);
    setInstallProgress(0);
    setInstallTerminalOutput([]);
    setShowInstallComplete(false);
    setIsInstallationComplete(false);

    const installStatus = new EventSource('/api/takserver/install-status-stream');
    installStatus.addEventListener('install-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'terminal') {
          setInstallTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
          }]);
        } else if (data.type === 'status') {
          setInstallProgress(data.progress);
          if (data.error) {
            setInstallError(data.error);
            setIsInstallationComplete(true);
          }
          if (data.status === 'complete' || data.status === 'error') {
            setIsInstallationComplete(true);
          }
        }
      } catch (error) {
        // Error handling remains but without logging
      }
    });

    return () => {
      installStatus.close();
    };
  }, [showInstallProgress]);

  // Uninstall status stream
  useEffect(() => {
    if (!showUninstallProgress) {
      return;
    }

    // Clear any previous state when starting a new uninstallation
    setUninstallError(undefined);
    setUninstallProgress(0);
    setUninstallTerminalOutput([]);
    setShowUninstallComplete(false);
    setIsUninstallationComplete(false);

    const uninstallStatus = new EventSource('/api/takserver/uninstall-status-stream');
    
    const handleUninstallStatus = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'terminal') {
          setUninstallTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
          }]);
        } else if (data.type === 'status') {
          setUninstallProgress(data.progress);
          if (data.error) {
            setUninstallError(data.error);
            setIsUninstallationComplete(true);
          }
          if (data.status === 'complete' || data.status === 'error') {
            setIsUninstallationComplete(true);
          }
        }
      } catch (error) {
        // Error handling remains but without logging
      }
    };

    uninstallStatus.addEventListener('uninstall-status', handleUninstallStatus);

    return () => {
      uninstallStatus.removeEventListener('uninstall-status', handleUninstallStatus);
      uninstallStatus.close();
    };
  }, [showUninstallProgress]);

  const handleUninstall = () => {
    onUninstallConfirm();
  };

  const resetInstallState = () => {
    setShowInstallComplete(false);
    setInstallProgress(0);
    setInstallError(undefined);
    setInstallTerminalOutput([]);
    setIsInstallationComplete(true);
    onInstallComplete();
  };

  const resetUninstallState = () => {
    setShowUninstallComplete(false);
    setUninstallProgress(0);
    setUninstallError(undefined);
    setUninstallTerminalOutput([]);
    setIsUninstallationComplete(false);
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
          className="w-[95%] mx-auto sm:w-full max-w-lg md:max-w-2xl xl:max-w-3xl"
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
                ? "Uploading file to server..." 
                : `Progress: ${installProgress}%`
              }
            />
            {installTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background [&_*::selection]:bg-blue-500/80 [&_*::selection]:text-primary"
                content={installTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {installTerminalOutput.map((line, index) => (
                    <div key={index}>
                      <div className={`font-mono text-sm whitespace-pre-wrap ${line.isError ? 'text-destructive' : 'text-foreground'}`}>
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
          className="w-[95%] mx-auto xl:w-full"
        >
          <DialogHeader>
            <DialogTitle>
              {installError ? "Installation Failed" : "Installation Complete"}
            </DialogTitle>
            <DialogDescription className="break-words">
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
          className="w-[95%] mx-auto xl:w-full"
        >
          <DialogHeader>
            <DialogTitle>Confirm Uninstall</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall TAK Server? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col lg:flex-row gap-2">
            <Button variant="outline" onClick={onUninstallConfirmClose} className="w-full lg:w-auto">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleUninstall} className="w-full lg:w-auto">
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Progress Dialog */}
      <Dialog 
        open={showUninstallProgress && !showUninstallComplete} 
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
          className="w-[95%] mx-auto sm:w-full max-w-lg md:max-w-2xl xl:max-w-3xl"
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
                ? "Uploading file to server..." 
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
          className="w-[95%] mx-auto xl:w-full"
        >
          <DialogHeader>
            <DialogTitle>
              {uninstallError ? "Uninstallation Failed" : "Uninstallation Complete"}
            </DialogTitle>
            <DialogDescription className="break-words">
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