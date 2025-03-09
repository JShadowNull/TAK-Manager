import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../shared/ui/shadcn/dialog';
import { Progress } from '../../../shared/ui/shadcn/progress';
import { ScrollArea } from '../../../shared/ui/shadcn/scroll-area';
import { Button } from '../../../shared/ui/shadcn/button';

interface TerminalLine {
  message: string;
  isError: boolean;
}

interface InstallPopupProps {
  showInstallProgress: boolean;
  onInstallComplete: () => void;
  uploadProgress?: number;
}

const InstallPopup: React.FC<InstallPopupProps> = ({
  showInstallProgress,
  onInstallComplete,
  uploadProgress = 0
}) => {
  // Installation state
  const [installProgress, setInstallProgress] = useState(0);
  const [installTerminalOutput, setInstallTerminalOutput] = useState<TerminalLine[]>([]);
  const [installError, setInstallError] = useState<string>();
  const [showInstallComplete, setShowInstallComplete] = useState(false);
  const [isInstallationComplete, setIsInstallationComplete] = useState(false);
  
  // Track whether we've transitioned from upload to installation
  const [uploadCompleted, setUploadCompleted] = useState(false);

  // Subscribe to SSE events for installation status
  useEffect(() => {
    if (showInstallProgress && !showInstallComplete) {
      // Clear previous state
      setInstallProgress(0);
      setInstallTerminalOutput([]);
      setInstallError(undefined);
      setIsInstallationComplete(false);
      
      // Reset uploadCompleted flag if we're starting from the beginning
      if (uploadProgress === 0) {
        setUploadCompleted(false);
      }

      const installStatus = new EventSource('/api/takserver/install-status-stream');
      
      const handleInstallStatus = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle terminal output
          if (data.type === 'terminal') {
            setInstallTerminalOutput(prev => [...prev, {
              message: data.message,
              isError: data.isError,
            }]);
          } 
          // Also handle new format terminal output for compatibility
          else if (data.terminal) {
            setInstallTerminalOutput(prev => [
              ...prev, 
              { 
                message: data.message || data.terminal, 
                isError: data.type === 'error' || data.error
              }
            ]);
            
            // Mark upload as completed once we start getting terminal output
            if (!uploadCompleted && uploadProgress === 100) {
              setUploadCompleted(true);
            }
          } 
          // Handle error events
          else if (data.error) {
            setInstallError(data.error);
            setIsInstallationComplete(true);
          } 
          // Handle status/progress updates
          else if (data.type === 'status') {
            setInstallProgress(data.progress);
            if (data.status === 'complete' || data.status === 'error') {
              setIsInstallationComplete(true);
            }
          }
          // Handle direct progress updates (new format)
          else if (typeof data.progress === 'number') {
            setInstallProgress(data.progress);
            if (data.progress === 100) {
              setIsInstallationComplete(true);
            }
          }
        } catch (error) {
          console.error('Error parsing install event:', error);
        }
      };

      // Add handlers for all events
      installStatus.addEventListener('install-status', handleInstallStatus);
      installStatus.addEventListener('message', handleInstallStatus); // Fallback for events without specific types
      installStatus.addEventListener('error', () => {
        console.error('SSE connection error for installation');
      });

      return () => {
        installStatus.removeEventListener('install-status', handleInstallStatus);
        installStatus.removeEventListener('message', handleInstallStatus);
        installStatus.close();
      };
    }
  }, [showInstallProgress, showInstallComplete, uploadProgress]);

  // Separate useEffect to watch uploadProgress and track when upload completes
  useEffect(() => {
    if (uploadProgress === 100 && !uploadCompleted) {
      setUploadCompleted(true);
    }
  }, [uploadProgress, uploadCompleted]);

  const resetInstallState = () => {
    setInstallProgress(0);
    setInstallTerminalOutput([]);
    setInstallError(undefined);
    setShowInstallComplete(false);
    setIsInstallationComplete(false);
    setUploadCompleted(false);
    onInstallComplete();
  };

  // Installation dialog content
  const renderInstallContent = () => (
    <>
      <DialogHeader>
        <DialogTitle>Installing TAK Server</DialogTitle>
        <DialogDescription>
          {installProgress === 100 
            ? "Installation complete. Review the logs and click Next to continue." 
            : "Please wait while TAK Server is being installed..."}
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        {/* Show upload progress if upload is not completed */}
        {!uploadCompleted && uploadProgress < 100 && (
          <>
            <Progress 
              value={uploadProgress}
              text={`Uploading installation files: ${uploadProgress}%`}
            />
          </>
        )}
        
        {/* Show installation progress only after upload is completed or once we start getting installation events */}
        {(uploadCompleted || installProgress > 0) && (
          <Progress 
            value={installProgress}
            isIndeterminate={installProgress === 0}
            text={installProgress === 0 
              ? "Preparing installation..." 
              : `Installation progress: ${installProgress}%`
            }
          />
        )}
        
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
        {isInstallationComplete && installProgress === 100 && (
          <Button onClick={() => setShowInstallComplete(true)}>
            Next
          </Button>
        )}
      </DialogFooter>
    </>
  );

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
          {renderInstallContent()}
        </DialogContent>
      </Dialog>

      {/* Install Complete Dialog - ONLY shows when installation is actually complete, not when upload is complete */}
      <Dialog open={showInstallComplete && isInstallationComplete && installProgress === 100}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
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
    </>
  );
};

export default InstallPopup; 