import React from 'react';
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

interface PopupsProps {
  // Installation props
  showInstallProgress: boolean;
  showInstallComplete: boolean;
  installProgress: number;
  installError: string | undefined;
  onInstallProgressClose: () => void;
  onInstallComplete: () => void;
  onMoveToInstallComplete: () => void;
  terminalOutput: string[];

  // Uninstallation props
  showUninstallConfirm: boolean;
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallProgress: number;
  uninstallError: string | undefined;
  onUninstallConfirmClose: () => void;
  onUninstall: () => void;
  onUninstallProgressClose: () => void;
  onUninstallComplete: () => void;
  onMoveToUninstallComplete: () => void;
  uninstallTerminalOutput: string[];
}

const Popups: React.FC<PopupsProps> = ({
  // Installation props
  showInstallProgress,
  showInstallComplete,
  installProgress,
  installError,
  onInstallProgressClose,
  onInstallComplete,
  onMoveToInstallComplete,
  terminalOutput,

  // Uninstallation props
  showUninstallConfirm,
  showUninstallProgress,
  showUninstallComplete,
  uninstallProgress,
  uninstallError,
  onUninstallConfirmClose,
  onUninstall,
  onUninstallProgressClose,
  onUninstallComplete,
  onMoveToUninstallComplete,
  uninstallTerminalOutput
}) => {
  return (
    <>
      {/* Installation Progress Dialog */}
      <Dialog 
        open={showInstallProgress} 
        onOpenChange={installProgress < 100 ? undefined : onInstallProgressClose}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Installing TAK Server</DialogTitle>
            <DialogDescription>
              {installProgress === 100 
                ? "Installation complete. Review the logs and click Next to continue." 
                : "Please wait while TAK Server is being installed..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress value={installProgress} className="w-full" />
            <div className="mt-2 text-sm text-muted-foreground">
              Progress: {installProgress}%
            </div>
            <ScrollArea 
              className="w-full rounded-md border p-4 mt-4"
              autoScroll={true}
              content={terminalOutput}
            >
              <div className="font-mono text-sm">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          {installProgress === 100 && !installError && (
            <DialogFooter>
              <Button onClick={onMoveToInstallComplete}>
                Next
              </Button>
            </DialogFooter>
          )}
          {installError && (
            <DialogFooter>
              <Button onClick={onInstallProgressClose}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Installation Complete Dialog */}
      <Dialog open={showInstallComplete} onOpenChange={onInstallComplete}>
        <DialogContent>
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
      <Dialog open={showUninstallConfirm} onOpenChange={onUninstallConfirmClose}>
        <DialogContent>
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
        onOpenChange={uninstallProgress < 100 ? undefined : onUninstallProgressClose}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstalling TAK Server</DialogTitle>
            <DialogDescription>
              {uninstallProgress === 100 
                ? "Uninstallation complete. Review the logs and click Next to continue." 
                : "Please wait while TAK Server is being uninstalled..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress value={uninstallProgress} className="w-full" />
            <div className="mt-2 text-sm text-muted-foreground">
              Progress: {uninstallProgress}%
            </div>
            <ScrollArea 
              className="w-full rounded-md border p-4 mt-4"
              autoScroll={true}
              content={uninstallTerminalOutput}
            >
              <div className="font-mono text-sm">
                {uninstallTerminalOutput.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          {uninstallProgress === 100 && !uninstallError && (
            <DialogFooter>
              <Button onClick={onMoveToUninstallComplete}>
                Next
              </Button>
            </DialogFooter>
          )}
          {uninstallError && (
            <DialogFooter>
              <Button onClick={onUninstallProgressClose}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Uninstall Complete Dialog */}
      <Dialog open={showUninstallComplete} onOpenChange={onUninstallComplete}>
        <DialogContent>
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