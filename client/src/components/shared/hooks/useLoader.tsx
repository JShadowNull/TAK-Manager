import { useCallback, useEffect, useState } from 'react';
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

export type LoaderOptions = {
  namespace: SocketNamespace;
  operationType: OperationType;
  targetId?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
  operation?: (targetId: string, operationType: string) => Promise<any>;
};

export function useLoader({
  namespace,
  operationType,
  targetId,
  onComplete,
  onError,
  onProgress,
  operation
}: LoaderOptions) {
  if (!namespace) {
    throw new Error('[useLoader] Namespace is required');
  }

  const { emit, socket, on } = useSocket(namespace);
  const [operationState, setOperationState] = useState<OperationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check if this operation is for our target
  const isTargetOperation = useCallback((details?: Record<string, any>) => {
    if (!targetId) return true;
    // Add more logging to debug the target matching
    const isTarget = !details || details.container === targetId;
    console.debug('[useLoader] Target check:', { 
      targetId, 
      details,
      containerMatch: details?.container === targetId,
      hasDetails: !!details,
      isTarget
    });
    return isTarget;
  }, [targetId]);

  // Subscribe to operation status events
  useEffect(() => {
    console.debug('[useLoader] Setting up operation status subscription:', {
      namespace,
      operationType,
      targetId,
      currentOperation: operationState?.operation
    });
    
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleOperationStatus = (status: OperationStatus) => {
      console.debug('[useLoader] Received operation status:', {
        status,
        currentOperationType: operationType,
        isTarget: isTargetOperation(status.details),
        currentOperation: operationState?.operation
      });
      
      if (!mounted || !isTargetOperation(status.details)) {
        console.debug('[useLoader] Ignoring status:', {
          mounted,
          isTarget: isTargetOperation(status.details)
        });
        return;
      }

      // Always update operation state immediately
      setOperationState(status);
      
      if (status.operation === operationType) {
        switch (status.status) {
          case 'in_progress':
            console.debug('[useLoader] Operation in progress:', {
              operation: status.operation,
              message: status.message,
              progress: status.progress
            });
            setIsLoading(true);
            if (status.progress !== undefined) {
              setProgress(status.progress);
              onProgress?.(status.progress);
            }
            break;
          case 'complete':
            console.debug('[useLoader] Operation complete:', {
              operation: status.operation,
              message: status.message
            });
            setIsLoading(false);
            setProgress(100);
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            onComplete?.();
            break;
          case 'failed':
            console.debug('[useLoader] Operation failed:', {
              operation: status.operation,
              error: status.error,
              message: status.message
            });
            setIsLoading(false);
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            onError?.(status.error || 'Operation failed');
            break;
        }
      }
    };

    const unsubscribe = on('operation_status', handleOperationStatus);

    return () => {
      console.debug('[useLoader] Cleaning up operation status subscription:', {
        namespace,
        operationType,
        targetId
      });
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [on, operationType, isTargetOperation, onComplete, onError, onProgress]);

  // Execute operation with loading state
  const executeWithLoading = useCallback(async (
    options: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
    } = {}
  ) => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      console.debug('[useLoader] Starting operation:', { 
        options, 
        targetId,
        socketConnected: socket?.connected,
        currentOperation: operationState?.operation
      });
      
      setIsLoading(true);
      setProgress(0);
      setOperationState({
        operation: operationType,
        status: 'in_progress',
        message: options.loadingMessage || 'Operation in progress...',
        progress: 0,
        details: { container: targetId }
      });
      
      if (!operation) {
        throw new Error('No operation handler provided');
      }

      console.debug('[useLoader] Executing operation:', { 
        operationType,
        targetId
      });
      
      const result = await operation(targetId || '', operationType);
      console.debug('[useLoader] Operation result:', result);
      
      // Check if the result contains an error
      if (result && typeof result === 'object' && 'error' in result) {
        throw new Error(result.error);
      }
      
      // Start timeout for socket status update
      timeoutId = setTimeout(() => {
        console.debug('[useLoader] No status update received, completing operation');
        setIsLoading(false);
        setProgress(100);
        setOperationState({
          operation: operationType,
          status: 'complete',
          message: options.successMessage || 'Operation completed successfully',
          progress: 100,
          details: { container: targetId }
        });
      }, 5000); // 5 second timeout

    } catch (error) {
      console.error('[useLoader] Operation failed:', error);
      
      // Extract error message
      const errorMsg = options.errorMessage || 
        (error instanceof Error ? error.message : 'Operation failed');
      
      setIsLoading(false);
      setProgress(0);
      setOperationState({
        operation: operationType,
        status: 'failed',
        message: errorMsg,
        error: errorMsg,
        progress: 0,
        details: { container: targetId }
      });
      
      onError?.(errorMsg);
      throw error;
    }
    
    // Return cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [operation, targetId, operationType, onError, socket, operationState]);

  // Safe emit wrapper
  const safeEmit = useCallback((event: string, data?: any): boolean => {
    if (!socket?.connected) {
      console.warn('[useLoader] Socket not connected, cannot emit event:', event);
      return false;
    }
    return emit(event, { ...data, container: targetId });
  }, [socket, emit, targetId]);

  return {
    isLoading,
    progress,
    message: operationState?.message || '',
    error: operationState?.error,
    execute: executeWithLoading,
    emit: safeEmit
  };
}

// Example usage:
// const { isLoading, message, executeWithLoading, emit } = useLoader({
//   namespace: '/docker-manager',
//   operationType: 'start',
//   onComplete: () => console.log('Operation completed'),
//   onError: (error) => console.error('Operation failed:', error)
// });
// 
// // Using executeWithLoading with emit
// const startContainer = () => executeWithLoading(
//   () => containerStartFunction(),
//   {
//     loadingMessage: 'Starting container...',
//     successMessage: 'Container started successfully',
//     errorMessage: 'Failed to start container',
//     emitEvent: 'start_container',
//     emitData: { container: 'my-container' }
//   }
// );