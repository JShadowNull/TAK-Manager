import { useState } from 'react';
import useFetch from '../../shared/hooks/useFetch';
import { UseSocketReturn } from '../../shared/hooks/useSocket';

interface UseUninstallProps {
  socket: UseSocketReturn;
  setOperationInProgress: (inProgress: boolean) => void;
  setCurrentOperation: (operation: 'start' | 'stop' | 'restart' | 'uninstall' | null) => void;
}

interface UseUninstallReturn {
  // States
  showUninstallConfirm: boolean;
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallId: string | null;
  uninstallProgress: number;
  uninstallError: string | undefined;
  
  // State setters
  setShowUninstallConfirm: (show: boolean) => void;
  setShowUninstallProgress: (show: boolean) => void;
  setShowUninstallComplete: (show: boolean) => void;
  setUninstallId: (id: string | null) => void;
  setUninstallProgress: (progress: number) => void;
  setUninstallError: (error: string | undefined) => void;
  
  // Handlers
  handleUninstall: () => Promise<void>;
  handleUninstallComplete: () => void;
}

export function useUninstall({ 
  socket, 
  setOperationInProgress, 
  setCurrentOperation 
}: UseUninstallProps): UseUninstallReturn {
  // Uninstallation states
  const [showUninstallConfirm, setShowUninstallConfirm] = useState<boolean>(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState<boolean>(false);
  const [showUninstallComplete, setShowUninstallComplete] = useState<boolean>(false);
  const [uninstallId, setUninstallId] = useState<string | null>(null);
  const [uninstallProgress, setUninstallProgress] = useState<number>(0);
  const [uninstallError, setUninstallError] = useState<string | undefined>(undefined);

  const { post } = useFetch();

  const handleUninstall = async () => {
    try {
      setShowUninstallConfirm(false);
      setShowUninstallProgress(true);
      setUninstallError(undefined);
      
      console.log('Initiating uninstall operation');
      setCurrentOperation('uninstall');
      setOperationInProgress(true);
      
      const response = await post('/api/takserver/uninstall-takserver');
      console.log('Uninstall request sent to backend:', response);

      if (response.success && response.uninstall_id) {
        setUninstallId(response.uninstall_id);
      } else {
        throw new Error(response.message || 'Uninstallation failed to start');
      }

    } catch (error) {
      console.error('Error during uninstall operation:', error);
      setUninstallError(error instanceof Error ? error.message : 'Uninstallation failed');
      setShowUninstallProgress(false);
      setShowUninstallComplete(true);
      setOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleUninstallComplete = () => {
    setShowUninstallComplete(false);
  };

  return {
    // States
    showUninstallConfirm,
    showUninstallProgress,
    showUninstallComplete,
    uninstallId,
    uninstallProgress,
    uninstallError,
    
    // State setters
    setShowUninstallConfirm,
    setShowUninstallProgress,
    setShowUninstallComplete,
    setUninstallId,
    setUninstallProgress,
    setUninstallError,
    
    // Handlers
    handleUninstall,
    handleUninstallComplete
  };
} 