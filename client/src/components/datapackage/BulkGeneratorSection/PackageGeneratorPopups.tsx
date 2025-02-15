import React, { useState, useEffect } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/shadcn/dialog";
import { Progress } from "@/components/shared/ui/shadcn/progress";
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";

interface TerminalLine {
  message: string;
  isError: boolean;
  timestamp: number;
}

interface PopupsProps {
  onGenerateComplete: () => void;
  showGenerateProgress?: boolean;
}

const Popups: React.FC<PopupsProps> = ({
  onGenerateComplete,
  showGenerateProgress = false
}) => {
  // Generation state
  const [showGenerateComplete, setShowGenerateComplete] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateError, setGenerateError] = useState<string>();
  const [generateTerminalOutput, setGenerateTerminalOutput] = useState<TerminalLine[]>([]);
  const [isGenerationComplete, setIsGenerationComplete] = useState(false);

  // Generation status stream
  useEffect(() => {
    if (!showGenerateProgress) {
      return;
    }

    // Clear any previous state when starting a new generation
    setGenerateError(undefined);
    setGenerateProgress(0);
    setGenerateTerminalOutput([]);
    setShowGenerateComplete(false);
    setIsGenerationComplete(false);

    const generateStatus = new EventSource('/api/datapackage/generate-status-stream');
    generateStatus.addEventListener('package-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'terminal') {
          setGenerateTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: data.isError,
            timestamp: data.timestamp || Date.now()
          }]);
        } else {
          setGenerateProgress(data.progress);
          setGenerateTerminalOutput(prev => [...prev, {
            message: data.message,
            isError: false,
            timestamp: data.timestamp || Date.now()
          }]);
          if (data.error) {
            setGenerateError(data.error);
            setGenerateTerminalOutput(prev => [...prev, {
              message: `Error: ${data.error}`,
              isError: true,
              timestamp: data.timestamp || Date.now()
            }]);
            setIsGenerationComplete(true);
          }
          if (data.status === 'complete') {
            setIsGenerationComplete(true);
          }
        }
      } catch (error) {
        // Error handling remains but without logging
      }
    });

    return () => {
      if (isGenerationComplete && showGenerateComplete) {
        generateStatus.close();
      }
    };
  }, [showGenerateProgress]);

  const resetGenerateState = () => {
    setShowGenerateComplete(false);
    setGenerateProgress(0);
    setGenerateError(undefined);
    setGenerateTerminalOutput([]);
    setIsGenerationComplete(false);
    onGenerateComplete();
  };

  return (
    <>
      {/* Generate Progress Dialog */}
      <Dialog 
        open={showGenerateProgress && !showGenerateComplete} 
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
            <DialogTitle>Generating Data Packages</DialogTitle>
            <DialogDescription>
              {generateProgress === 100 
                ? "Generation complete. Review the logs and click Next to continue." 
                : "Please wait while data packages are being generated..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress 
              value={generateProgress}
              isIndeterminate={generateProgress === 0}
              text={generateProgress === 0 
                ? "Initializing..." 
                : `Progress: ${generateProgress}%`
              }
            />
            {generateTerminalOutput.length > 0 && (
              <ScrollArea 
                className="w-full rounded-md border p-4 mt-4 h-[300px] bg-background"
                content={generateTerminalOutput}
                autoScroll={true}
              >
                <div className="space-y-1">
                  {generateTerminalOutput.map((line, index) => (
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
            {isGenerationComplete && (
              <Button onClick={() => setShowGenerateComplete(true)}>
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Complete Dialog */}
      <Dialog open={showGenerateComplete}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {generateError ? "Generation Failed" : "Generation Complete"}
            </DialogTitle>
            <DialogDescription>
              {generateError ? generateError : "Data packages have been successfully generated!"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetGenerateState}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Popups; 