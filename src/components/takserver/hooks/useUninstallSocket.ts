import useSocket, { BACKEND_EVENTS } from '../../shared/hooks/useSocket';
import { UninstallState } from '../types';

type UpdateState = (state: Partial<UninstallState>) => void;

export const useUninstallSocket = () => {
  const uninstallSocket = useSocket(BACKEND_EVENTS.TAKSERVER_UNINSTALL.namespace, {
    initialState: {
      isUninstalling: false,
      uninstallComplete: false,
      uninstallSuccess: false,
      uninstallError: undefined,
      status: undefined,
      operationInProgress: false,
      progress: 0
    },
    eventHandlers: {
      handleTerminalOutput: true,
      onConnect: () => {
        console.log('Connected to uninstaller service');
      },
      'operation_status': (data: { 
        operation: string, 
        status: string, 
        message: string, 
        details?: {
          progress?: number
        } | null,
        progress?: number | null
      }, { updateState }: { updateState: UpdateState }) => {
        console.log('Operation Status:', data);
        
        // Get progress from either details or top-level progress field
        const progress = data.details?.progress ?? data.progress ?? 0;
        
        // Update state based on operation status
        if (data.status === 'complete') {
          updateState({
            isUninstalling: true,
            uninstallComplete: true,
            uninstallSuccess: true,
            uninstallError: undefined,
            status: data.status,
            operationInProgress: false,
            progress: 100
          });
        } else if (data.status === 'failed') {
          updateState({
            isUninstalling: true,
            uninstallComplete: true,
            uninstallSuccess: false,
            uninstallError: data.message,
            status: data.status,
            operationInProgress: false,
            progress
          });
        } else {
          // in_progress
          updateState({
            isUninstalling: true,
            uninstallComplete: false,
            uninstallSuccess: false,
            uninstallError: undefined,
            status: data.status,
            operationInProgress: true,
            progress
          });
        }
      }
    }
  });

  return {
    state: uninstallSocket.state as UninstallState,
    updateState: uninstallSocket.updateState,
    emit: uninstallSocket.emit
  };
}; 