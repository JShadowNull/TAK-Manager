import React from 'react';
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

interface OtaPopupsProps {
  // Upload progress props
  showUploadProgress: boolean;
  uploadProgress: number;
  uploadError?: string;
  onUploadProgressClose: () => void;
  isInitializing?: boolean;
  
  // Installation progress props
  showProgress: boolean;
  showComplete: boolean;
  progress: number;
  error?: string;
  title: string;
  message: string;
  onProgressClose: () => void;
  onComplete: () => void;
  onMoveToComplete: () => void;
  terminalOutput: string[];
}

const OtaPopups: React.FC<OtaPopupsProps> = ({
  // Upload progress props
  showUploadProgress,
  uploadProgress,
  uploadError,
  onUploadProgressClose,
  isInitializing,
  
  // Installation progress props
  showProgress,
  showComplete,
  progress,
  error,
  title,
  message,
  onProgressClose,
  onComplete,
  onMoveToComplete,
  terminalOutput,
}) => {
  const getProgressDescription = () => {
    if (progress === 100) {
      return "Operation complete. Review the logs and click Next to continue.";
    }
    return message;
  };

  const getCompleteDescription = () => {
    if (error) return error;
    return `${title} completed successfully!`;
  };

  return (
    <>
      {/* File Upload Progress Dialog */}
      <Dialog 
        open={showUploadProgress} 
        onOpenChange={uploadProgress < 100 ? undefined : onUploadProgressClose}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uploading File</DialogTitle>
            <DialogDescription>
              {isInitializing 
                ? "Preparing file upload..."
                : uploadProgress === 100 
                ? "Upload complete. Starting configuration..." 
                : "Please wait while the file is being uploaded..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress value={isInitializing ? 0 : uploadProgress} className="w-full" />
            <div className="mt-2 text-sm text-muted-foreground">
              Progress: {isInitializing ? 0 : uploadProgress}%
            </div>
          </div>
          {uploadError && (
            <DialogFooter>
              <Button onClick={onUploadProgressClose}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Installation Progress Dialog */}
      <Dialog 
        open={showProgress} 
        onOpenChange={progress < 100 ? undefined : onProgressClose}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {getProgressDescription()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Progress value={progress} className="w-full" />
            <div className="mt-2 text-sm text-muted-foreground">
              Progress: {progress}%
            </div>
            {terminalOutput.length > 0 && (
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
            )}
          </div>
          {progress === 100 && !error && (
            <DialogFooter>
              <Button onClick={onMoveToComplete}>
                Next
              </Button>
            </DialogFooter>
          )}
          {error && (
            <DialogFooter>
              <Button onClick={onProgressClose}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showComplete} onOpenChange={onComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {error ? `${title} Failed` : `${title} Complete`}
            </DialogTitle>
            <DialogDescription>
              {getCompleteDescription()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onComplete}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OtaPopups;