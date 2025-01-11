import React, { useEffect, useRef } from 'react';
import { Button } from "../../shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../shared/ui/shadcn/dialog";
import { Progress } from "../../shared/ui/shadcn/progress";
import { ScrollArea } from "../../shared/ui/shadcn/scroll-area";

interface TerminalLine {
  message: string;
  isError: boolean;
  timestamp: number | null;
}

interface PopupsProps {
  // Installation props
  showInstallProgress: boolean;
  showInstallComplete: boolean;
  installProgress: number;
  installError?: string;
  onInstallProgressClose: () => void;
  onInstallComplete: () => void;
  onMoveToInstallComplete: () => void;
  terminalOutput: TerminalLine[];
  onStopInstallation?: () => void;

  // Uninstallation props
  showUninstallConfirm: boolean;
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallProgress: number;
  uninstallError?: string;
  onUninstallConfirmClose: () => void;
  onUninstall: () => void;
  onUninstallProgressClose: () => void;
  onUninstallComplete: () => void;
  onMoveToUninstallComplete: () => void;
  uninstallTerminalOutput: TerminalLine[];
}

const Popups: React.FC<PopupsProps> = ({
  // Installation props
  showInstallProgress,
  showInstallComplete,
  installProgress,
  installError,
  onInstallComplete,
  onMoveToInstallComplete,
  terminalOutput,
  onStopInstallation,

  // Uninstallation props
  showUninstallConfirm,
  showUninstallProgress,
  showUninstallComplete,
  uninstallProgress,
  uninstallError,
  onUninstallConfirmClose,
  onUninstall,
  onUninstallComplete,
  onMoveToUninstallComplete,
  uninstallTerminalOutput
}) => {
  // Refs for terminal output containers
  const installTerminalRef = useRef<HTMLDivElement>(null);
  const uninstallTerminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal output
  useEffect(() => {
    if (installTerminalRef.current && showInstallProgress) {
      installTerminalRef.current.scrollTop = installTerminalRef.current.scrollHeight;
    }
  }, [terminalOutput, showInstallProgress]);

  useEffect(() => {
    if (uninstallTerminalRef.current && showUninstallProgress) {
      uninstallTerminalRef.current.scrollTop = uninstallTerminalRef.current.scrollHeight;
    }
  }, [uninstallTerminalOutput, showUninstallProgress]);

  const renderTerminalLine = (line: TerminalLine) => (
    <div 
      className={`font-mono text-sm whitespace-pre-wrap ${line.isError ? 'text-destructive' : 'text-foreground'}`}
    >
      {line.timestamp && (
        <span className="text-muted-foreground mr-2">
          {new Date(line.timestamp).toLocaleTimeString()}
        </span>
      )}
      {line.message}
    </div>
  );

  return (
    <>
      {/* Installation Progress Dialog */}
      <Dialog 
        open={showInstallProgress} 
        onOpenChange={() => {}}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => {
            // Always prevent closing if showing progress
            e.preventDefault();
          }}
          onEscapeKeyDown={(e: KeyboardEvent) => {
            // Always prevent closing if showing progress
            e.preventDefault();
          }}
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
            {terminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background"
                ref={installTerminalRef}
                autoScroll={true}
                content={terminalOutput}
              >
                <div className="space-y-1">
                  {terminalOutput.map((line, index) => (
                    <div key={index}>
                      {renderTerminalLine(line)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            {installProgress < 100 && !installError && onStopInstallation && (
              <Button 
                variant="danger" 
                onClick={onStopInstallation}
              >
                Stop Installation
              </Button>
            )}
            {(installProgress === 100 || installError) && (
              <Button onClick={onMoveToInstallComplete}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Installation Complete Dialog */}
      <Dialog 
        open={showInstallComplete} 
        onOpenChange={() => {}}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
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
            <Button onClick={onInstallComplete}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Confirmation Dialog */}
      <Dialog 
        open={showUninstallConfirm} 
        onOpenChange={() => {}}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
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
            <Button variant="danger" onClick={onUninstall}>
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Progress Dialog */}
      <Dialog 
        open={showUninstallProgress} 
        onOpenChange={() => {}}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => {
            // Always prevent closing if showing progress
            e.preventDefault();
          }}
          onEscapeKeyDown={(e: KeyboardEvent) => {
            // Always prevent closing if showing progress
            e.preventDefault();
          }}
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
                ref={uninstallTerminalRef}
                autoScroll={true}
                content={uninstallTerminalOutput}
              >
                <div className="space-y-1">
                  {uninstallTerminalOutput.map((line, index) => (
                    <div key={index}>
                      {renderTerminalLine(line)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          {(uninstallProgress === 100 || uninstallError) && (
            <DialogFooter>
              <Button onClick={onMoveToUninstallComplete}>
                Next
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Uninstall Complete Dialog */}
      <Dialog 
        open={showUninstallComplete} 
        onOpenChange={() => {}}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {uninstallError ? "Uninstall Failed" : "Uninstall Complete"}
            </DialogTitle>
            <DialogDescription>
              {uninstallError ? uninstallError : "TAK Server has been successfully uninstalled!"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onUninstallComplete}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Popups; 