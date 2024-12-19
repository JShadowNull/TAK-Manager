import { useState, useCallback } from 'react';
import useSocket, { SocketNamespace } from './useSocket';

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

export function useOperationStatus(namespace: SocketNamespace) {
  const { socket } = useSocket(namespace);
  const [operationState, setOperationState] = useState<OperationState>({
    isLoading: false,
    operation: null,
    message: '',
  });

  // Handle operation status updates
  const handleOperationStatus = useCallback((status: OperationStatus) => {
    console.debug('Received operation_status event:', status);
    
    setOperationState(prevState => {
      const newState = {
        isLoading: status.status === 'in_progress',
        operation: status.operation,
        message: status.message,
        progress: status.progress,
        error: status.error,
        details: status.details,
      };
      
      console.debug('Updating operation state:', {
        prevState,
        newState,
        status
      });
      
      return newState;
    });
  }, []);

  // Subscribe to operation status events
  const subscribeToOperationStatus = useCallback(() => {
    if (!socket) {
      console.debug('Socket not available yet, skipping subscription');
      return () => {};
    }

    console.debug('Subscribing to operation_status events');
    socket.on('operation_status', handleOperationStatus);
    return () => {
      console.debug('Unsubscribing from operation_status events');
      socket.off('operation_status', handleOperationStatus);
    };
  }, [socket, handleOperationStatus]);

  // Helper to check if a specific operation is in progress
  const isOperationInProgress = useCallback((operation: OperationType): boolean => {
    const inProgress = operationState.isLoading && operationState.operation === operation;
    console.debug('Checking operation progress:', {
      operation,
      inProgress,
      currentState: operationState
    });
    return inProgress;
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

    const message = operationState.message || defaultMessages[operation];
    console.debug('Getting operation loading text:', {
      operation,
      message,
      state: operationState
    });
    return message;
  }, [operationState, isOperationInProgress]);

  return {
    operationState,
    isOperationInProgress,
    getOperationLoadingText,
    subscribeToOperationStatus,
  };
} 