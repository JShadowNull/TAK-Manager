import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/shadcn/dialog';
import { Button } from './ui/shadcn/button';
import { useTakServer } from './ui/shadcn/sidebar/app-sidebar';

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
  const { serverState } = useTakServer();
  const [currentOperation, setCurrentOperation] = useState<'start' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentOperation(null);
      setError(null);
      setOperationMessage(null);
    }
  }, [isOpen]);

  // Close dialog if server becomes running
  useEffect(() => {
    if (serverState?.isRunning) {
      onOpenChange(false);
    }
  }, [serverState?.isRunning, onOpenChange]);

  // Handle operation status stream
  useEffect(() => {
    if (!currentOperation) return;

    const eventSource = new EventSource('/api/takserver/operation-status-stream');

    eventSource.addEventListener('operation-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Only handle events for our current operation
        if (data.operation === 'start') {
          setOperationMessage(data.message);

          if (data.status === 'complete' || data.status === 'error') {
            setCurrentOperation(null);
            if (data.error) {
              setError(data.error);
            }
          }
        }
      } catch (error) {
        setCurrentOperation(null);
        setError('Failed to parse operation status');
      }
    });

    return () => {
      eventSource.close();
    };
  }, [currentOperation]);

  const handleStart = async () => {
    try {
      setError(null);
      setOperationMessage(null);
      setCurrentOperation('start');
      
      const response = await fetch('/api/takserver/start-takserver', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Operation failed: ${response.statusText}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed');
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
        
        {operationMessage && (
          <p className="text-sm text-muted-foreground">{operationMessage}</p>
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