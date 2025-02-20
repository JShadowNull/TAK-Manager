import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/shadcn/dialog';
import { Button } from './ui/shadcn/button';
import { useTakServer } from './ui/shadcn/sidebar/app-sidebar';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';

interface TakServerRequiredDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

const TakServerRequiredDialog: React.FC<TakServerRequiredDialogProps> = ({
  isOpen,
  onOpenChange,
  title = "TAK Server Required",
  description = "This feature requires TAK Server to be running. Would you like to start it now?"
}) => {
  const { serverState, refreshServerStatus } = useTakServer();
  const { toast } = useToast();
  const [currentOperation, setCurrentOperation] = useState<'start' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentOperation(null);
      setError(null);
    }
  }, [isOpen]);

  // Close dialog if server becomes running
  useEffect(() => {
    if (serverState?.isRunning) {
      onOpenChange(false);
    }
  }, [serverState?.isRunning, onOpenChange]);

  const handleStart = async () => {
    try {
      setError(null);
      setCurrentOperation('start');
      
      const response = await fetch('/api/takserver/start-takserver', {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Operation failed: ${response.statusText}`);
      }

      // Force immediate status refresh
      await refreshServerStatus();

      toast({
        title: "Server Starting",
        description: "TAK Server Started Successfully",
        variant: "success"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      setError(errorMessage);
      toast({
        title: "Start Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Refresh status even on error to ensure UI consistency
      await refreshServerStatus();
    } finally {
      setCurrentOperation(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={currentOperation === 'start'}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={currentOperation === 'start'}
            loading={currentOperation === 'start'}
          >
            Start TAK Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TakServerRequiredDialog; 