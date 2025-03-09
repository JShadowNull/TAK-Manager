import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui/shadcn/dialog';
import { Progress } from '../../../shared/ui/shadcn/progress';
import { ScrollArea } from '../../../shared/ui/shadcn/scroll-area';
import { Button } from '../../../shared/ui/shadcn/button';

interface TerminalLine {
  message: string;
  isError: boolean;
}

interface UninstallPopupsProps {
  showUninstallConfirm: boolean;
  onUninstallConfirmClose: () => void;
  onUninstallConfirm: () => void;
  showUninstallProgress: boolean;
  onUninstallComplete: () => void;
}

const UninstallPopups: React.FC<UninstallPopupsProps> = ({
  showUninstallConfirm,
  onUninstallConfirmClose,
  onUninstallConfirm,
  showUninstallProgress,
  onUninstallComplete
}) => {
  // Uninstall state
  const [uninstallProgress, setUninstallProgress] = useState(0);
  const [uninstallTerminalOutput, setUninstallTerminalOutput] = useState<TerminalLine[]>([]);
  const [uninstallError, setUninstallError] = useState<string>();
  const [showUninstallComplete, setShowUninstallComplete] = useState(false);
  const [isUninstallationComplete, setIsUninstallationComplete] = useState(false);

  // Subscribe to SSE events for uninstallation status
  useEffect(() => {
    if (showUninstallProgress && !showUninstallComplete) {
      // Clear previous state
      setUninstallProgress(0);
      setUninstallTerminalOutput([]);
      setUninstallError(undefined);
      setIsUninstallationComplete(false);

      const uninstallStatus = new EventSource('/api/takserver/uninstall-status-stream');
      
      const handleUninstallStatus = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle terminal output
          if (data.type === 'terminal') {
            setUninstallTerminalOutput(prev => [...prev, {
              message: data.message,
              isError: data.isError,
            }]);
          } 
          // Also handle new format terminal output for compatibility
          else if (data.terminal) {
            setUninstallTerminalOutput(prev => [
              ...prev, 
              { 
                message: data.message || data.terminal, 
                isError: data.type === 'error' || data.error
              }
            ]);
          } 
          // Handle error events
          else if (data.error) {
            setUninstallError(data.error);
            setIsUninstallationComplete(true);
          } 
          // Handle status/progress updates
          else if (data.type === 'status') {
            setUninstallProgress(data.progress);
            if (data.status === 'complete' || data.status === 'error') {
              setIsUninstallationComplete(true);
            }
          }
          // Handle direct progress updates (new format)
          else if (typeof data.progress === 'number') {
            setUninstallProgress(data.progress);
            if (data.progress === 100) {
              setIsUninstallationComplete(true);
            }
          }
        } catch (error) {
        }
      };

      // Add handlers for all events
      uninstallStatus.addEventListener('uninstall-status', handleUninstallStatus);
      uninstallStatus.addEventListener('error', () => {
      });

      return () => {
        uninstallStatus.removeEventListener('uninstall-status', handleUninstallStatus);
        uninstallStatus.close();
      };
    }
  }, [showUninstallProgress, showUninstallComplete]);

  const resetUninstallState = () => {
    setUninstallProgress(0);
    setUninstallTerminalOutput([]);
    setUninstallError(undefined);
    setShowUninstallComplete(false);
    setIsUninstallationComplete(false);
    onUninstallComplete();
  };

  return (
    <>
      {/* Uninstall Confirmation Dialog */}
      <Dialog open={showUninstallConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Uninstallation</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall TAK Server? This will remove all TAK Server software, configuration, and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={onUninstallConfirmClose}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={onUninstallConfirm}
            >
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstallation Progress Dialog */}
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
                ? "Preparing uninstallation..." 
                : `Progress: ${uninstallProgress}%`
              }
            />
            {uninstallTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background [&_*::selection]:bg-blue-500/80 [&_*::selection]:text-primary"
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

export default UninstallPopups; 