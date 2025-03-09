import React from 'react';
import { Progress } from '@/components/shared/ui/shadcn/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shared/ui/shadcn/dialog';

interface FileUploadProgressProps {
  isOpen: boolean;
  fileName: string;
  progress: number;
}

const FileUploadProgress: React.FC<FileUploadProgressProps> = ({ 
  isOpen,
  fileName,
  progress
}) => {
  return (
    <Dialog open={isOpen}>
      <DialogContent 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-[95%] mx-auto sm:w-full max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Uploading File</DialogTitle>
          <DialogDescription>
            {progress < 100 
              ? "Please wait while your file is being uploaded..." 
              : "File uploaded"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Progress 
            value={progress}
            text={progress < 100 
              ? `Uploading ${fileName}: ${progress}%` 
              : `Processing ${fileName}...`
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadProgress; 