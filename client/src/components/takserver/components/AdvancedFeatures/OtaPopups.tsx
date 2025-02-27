import React, { useState, useEffect } from 'react';
import { Button } from "../../../shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/shadcn/dialog";
import { Progress } from "../../../shared/ui/shadcn/progress";
import { ScrollArea } from "../../../shared/ui/shadcn/scroll-area";

interface TerminalLine {
  message: string;
  isError: boolean;
  timestamp: number;
}

interface OtaPopupsProps {
  onConfigureComplete: () => void;
  onUpdateComplete: () => void;
  showConfigureProgress?: boolean;
  showUpdateProgress?: boolean;
}

const OtaPopups: React.FC<OtaPopupsProps> = ({
  onConfigureComplete,
  onUpdateComplete,
  showConfigureProgress = false,
  showUpdateProgress = false
}) => {
  // Configure state
  const [showConfigureComplete, setShowConfigureComplete] = useState(false);
  const [configureProgress, setConfigureProgress] = useState(0);
  const [configureError, setConfigureError] = useState<string>();
  const [configureTerminalOutput, setConfigureTerminalOutput] = useState<TerminalLine[]>([]);
  const [isConfigurationComplete, setIsConfigurationComplete] = useState(false);

  // Update state
  const [showUpdateComplete, setShowUpdateComplete] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string>();
  const [updateTerminalOutput, setUpdateTerminalOutput] = useState<TerminalLine[]>([]);
  const [isUpdateComplete, setIsUpdateComplete] = useState(false);

  // Configure status stream
  useEffect(() => {
    if (!showConfigureProgress) {
      return;
    }

    // Clear any previous state when starting a new configuration
    setConfigureError(undefined);
    setConfigureProgress(0);
    setConfigureTerminalOutput([]);
    setShowConfigureComplete(false);
    setIsConfigurationComplete(false);

    const configureStatus = new EventSource('/api/ota/status-stream');
    configureStatus.addEventListener('ota-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'terminal') {
          setConfigureTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
            timestamp: data.timestamp
          }]);
        } else if (data.type === 'status') {
          setConfigureProgress(data.progress);
          if (data.error) {
            setConfigureError(data.error);
            setConfigureTerminalOutput(prev => [...prev, {
              message: data.error,
              isError: true,
              timestamp: data.timestamp || Date.now()
            }]);
            setIsConfigurationComplete(true);
          }
          if (data.status === 'complete' || data.status === 'error') {
            setIsConfigurationComplete(true);
          }
        }
      } catch (error) {
        // Error handling remains but without logging
      }
    });

    return () => {
      if (isConfigurationComplete && showConfigureComplete) {
        configureStatus.close();
      }
    };
  }, [showConfigureProgress]);

  // Update status stream
  useEffect(() => {
    if (!showUpdateProgress) {
      return;
    }

    // Clear any previous state when starting a new update
    setUpdateError(undefined);
    setUpdateProgress(0);
    setUpdateTerminalOutput([]);
    setShowUpdateComplete(false);
    setIsUpdateComplete(false);

    const updateStatus = new EventSource('/api/ota/status-stream');
    updateStatus.addEventListener('ota-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'terminal') {
          setUpdateTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
            timestamp: data.timestamp
          }]);
        } else if (data.type === 'status') {
          setUpdateProgress(data.progress);
          if (data.error) {
            setUpdateError(data.error);
            setUpdateTerminalOutput(prev => [...prev, {
              message: data.error,
              isError: true,
              timestamp: data.timestamp || Date.now()
            }]);
            setIsUpdateComplete(true);
          }
          if (data.status === 'complete' || data.status === 'error') {
            setIsUpdateComplete(true);
          }
        }
      } catch (error) {
        // Error handling remains but without logging
      }
    });

    return () => {
      if (isUpdateComplete && showUpdateComplete) {
        updateStatus.close();
      }
    };
  }, [showUpdateProgress]);

  const resetConfigureState = () => {
    setShowConfigureComplete(false);
    setConfigureProgress(0);
    setConfigureError(undefined);
    setConfigureTerminalOutput([]);
    setIsConfigurationComplete(false);
    onConfigureComplete();
  };

  const resetUpdateState = () => {
    setShowUpdateComplete(false);
    setUpdateProgress(0);
    setUpdateError(undefined);
    setUpdateTerminalOutput([]);
    setIsUpdateComplete(false);
    onUpdateComplete();
  };

  return (
    <>
      {/* Configure Progress Dialog */}
      <Dialog 
        open={showConfigureProgress && !showConfigureComplete} 
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
            <DialogTitle>Configuring OTA</DialogTitle>
            <DialogDescription>
              {configureProgress === 100 
                ? "Configuration complete. Review the logs and click Next to continue." 
                : "Please wait while OTA is being configured..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress 
              value={configureProgress}
              isIndeterminate={configureProgress === 0}
              text={configureProgress === 0 
                ? "Initializing..." 
                : `Progress: ${configureProgress}%`
              }
            />
            {configureTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background [&_*::selection]:bg-blue-500/80 [&_*::selection]:text-primary"
                content={configureTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {configureTerminalOutput.map((line, index) => (
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
            {isConfigurationComplete && (
              <Button onClick={() => setShowConfigureComplete(true)}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Complete Dialog */}
      <Dialog open={showConfigureComplete}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {configureError ? "Configuration Failed" : "Configuration Complete"}
            </DialogTitle>
            <DialogDescription className="break-words">
              {configureError ? configureError : "OTA has been successfully configured! You can now use OTA features."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetConfigureState}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Progress Dialog */}
      <Dialog 
        open={showUpdateProgress && !showUpdateComplete} 
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
            <DialogTitle>Updating OTA</DialogTitle>
            <DialogDescription>
              {updateProgress === 100 
                ? "Update complete. Review the logs and click Next to continue." 
                : "Please wait while OTA is being updated..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress 
              value={updateProgress}
              isIndeterminate={updateProgress === 0}
              text={updateProgress === 0 
                ? "Initializing..." 
                : `Progress: ${updateProgress}%`
              }
            />
            {updateTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background"
                content={updateTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {updateTerminalOutput.map((line, index) => (
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
            {isUpdateComplete && (
              <Button onClick={() => setShowUpdateComplete(true)}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Complete Dialog */}
      <Dialog open={showUpdateComplete}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {updateError ? "Update Failed" : "Update Complete"}
            </DialogTitle>
            <DialogDescription className="break-words">
              {updateError ? updateError : "OTA has been successfully updated!"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetUpdateState}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OtaPopups;