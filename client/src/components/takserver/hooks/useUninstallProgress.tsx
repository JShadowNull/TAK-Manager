import { useEffect } from 'react';
import { UseSocketReturn } from '../../shared/hooks/useSocket';

interface UseUninstallProgressProps {
  socket: UseSocketReturn;
  uninstallId: string | null;
  showUninstallProgress: boolean;
  setUninstallProgress: (progress: number) => void;
  setUninstallError: (error: string | undefined) => void;
  setShowUninstallProgress: (show: boolean) => void;
  setShowUninstallComplete: (show: boolean) => void;
  setUninstallId: (id: string | null) => void;
  setOperationInProgress: (inProgress: boolean) => void;
  setCurrentOperation: (operation: 'start' | 'stop' | 'restart' | 'uninstall' | null) => void;
  get: (url: string) => Promise<any>;
}

export function useUninstallProgress({
  socket,
  uninstallId,
  showUninstallProgress,
  setUninstallProgress,
  setUninstallError,
  setShowUninstallProgress,
  setShowUninstallComplete,
  setUninstallId,
  setOperationInProgress,
  setCurrentOperation,
  get
}: UseUninstallProgressProps) {
  useEffect(() => {
    let pollTimer: NodeJS.Timeout;
    
    const pollUninstallProgress = async () => {
      if (uninstallId && showUninstallProgress) {
        try {
          const response = await get(`/api/takserver/uninstall-progress/${uninstallId}`);
          
          setUninstallProgress(response.progress);
          
          if (response.status === 'complete') {
            // Clear the timer immediately
            if (pollTimer) {
              clearTimeout(pollTimer);
            }
            // Only update operation states, don't show completion dialog
            setUninstallId(null);
            setOperationInProgress(false);
            setCurrentOperation(null);
            socket.emit('request_initial_state');
            return;
          } else if (response.status === 'error') {
            if (pollTimer) {
              clearTimeout(pollTimer);
            }
            // Update states and show error
            setUninstallError(response.error);
            setShowUninstallProgress(false);
            setShowUninstallComplete(true);
            setUninstallId(null);
            setOperationInProgress(false);
            setCurrentOperation(null);
            socket.emit('request_initial_state');
            return;
          } else {
            pollTimer = setTimeout(pollUninstallProgress, 1000);
          }
        } catch (error) {
          console.error('Error polling uninstallation progress:', error);
          // Stop polling and show error
          setUninstallError(error instanceof Error ? error.message : 'Uninstallation failed');
          setShowUninstallProgress(false);
          setShowUninstallComplete(true);
          setUninstallId(null);
          setOperationInProgress(false);
          setCurrentOperation(null);
          socket.emit('request_initial_state');
        }
      }
    };

    if (uninstallId && showUninstallProgress) {
      pollUninstallProgress();
    }

    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [
    uninstallId,
    showUninstallProgress,
    get,
    socket,
    setUninstallProgress,
    setUninstallError,
    setShowUninstallProgress,
    setShowUninstallComplete,
    setUninstallId,
    setOperationInProgress,
    setCurrentOperation
  ]);
} 