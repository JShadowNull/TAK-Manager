import { useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export type OperationType = 
  | 'start'
  | 'stop'
  | 'restart'
  | 'install'
  | 'uninstall'
  | 'update'
  | 'configure'
  | 'validate';

export type OperationStatus = {
  operation: OperationType;
  status: 'in_progress' | 'complete' | 'failed';
  message: string;
  progress?: number;
  error?: string;
  details?: Record<string, any>;
};

export type OperationState = {
  isLoading: boolean;
  operation: OperationType | null;
  message: string;
  progress?: number;
  error?: string;
  details?: Record<string, any>;
};

export function useOperationStatus(socket: Socket) {
  const [operationState, setOperationState] = useState<OperationState>({
    isLoading: false,
    operation: null,
    message: '',
  });

  // Handle operation status updates
  const handleOperationStatus = useCallback((status: OperationStatus) => {
    setOperationState({
      isLoading: status.status === 'in_progress',
      operation: status.operation,
      message: status.message,
      progress: status.progress,
      error: status.error,
      details: status.details,
    });
  }, []);

  // Subscribe to operation status events
  const subscribeToOperationStatus = useCallback(() => {
    socket.on('operation_status', handleOperationStatus);
    return () => {
      socket.off('operation_status', handleOperationStatus);
    };
  }, [socket, handleOperationStatus]);

  // Helper to check if a specific operation is in progress
  const isOperationInProgress = useCallback((operation: OperationType): boolean => {
    return operationState.isLoading && operationState.operation === operation;
  }, [operationState]);

  // Helper to get loading text for an operation
  const getOperationLoadingText = useCallback((operation: OperationType): string => {
    if (!isOperationInProgress(operation)) return '';

    const defaultMessages: Record<OperationType, string> = {
      start: 'Starting...',
      stop: 'Stopping...',
      restart: 'Restarting...',
      install: 'Installing...',
      uninstall: 'Uninstalling...',
      update: 'Updating...',
      configure: 'Configuring...',
      validate: 'Validating...',
    };

    return operationState.message || defaultMessages[operation];
  }, [operationState, isOperationInProgress]);

  return {
    operationState,
    isOperationInProgress,
    getOperationLoadingText,
    subscribeToOperationStatus,
  };
} 