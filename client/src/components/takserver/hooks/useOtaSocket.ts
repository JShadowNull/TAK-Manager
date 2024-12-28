import useSocket from '../../shared/hooks/useSocket';

interface OtaState {
  isInstalling: boolean;
  installationComplete: boolean;
  installationSuccess: boolean;
  installationError?: string;
  error?: string;
  isRollingBack: boolean;
  status?: string;
  operationInProgress: boolean;
  progress: number;
  showNextButton: boolean;
}

export const useOtaSocket = () => {
  const otaSocket = useSocket('/ota-update', {
    initialState: {
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      installationError: undefined,
      error: undefined,
      isRollingBack: false,
      status: undefined,
      operationInProgress: false,
      progress: 0,
      showNextButton: false
    },
    eventHandlers: {
      handleTerminalOutput: true,
      onConnect: () => {
        console.log('Connected to OTA update service');
      },
      'operation_status': (data: { 
        operation: string, 
        status: string, 
        message: string, 
        details?: {
          isUpdating: boolean,
          updateComplete: boolean,
          updateSuccess: boolean,
          updateError: string | null,
          progress?: number
        } | null,
        progress?: number
      }, { updateState }) => {
        console.log('Operation Status:', data);
        
        // Get progress from either details or top-level progress field
        const progress = data.details?.progress ?? data.progress ?? 0;
        
        // Update state based on operation status
        if (data.status === 'complete') {
          updateState({
            isInstalling: false,
            installationComplete: true,
            installationSuccess: true,
            installationError: undefined,
            error: undefined,
            isRollingBack: false,
            status: data.status,
            operationInProgress: false,
            progress: 100,
            showNextButton: true
          });
        } else if (data.status === 'failed') {
          updateState({
            isInstalling: false,
            installationComplete: true,
            installationSuccess: false,
            installationError: data.message,
            error: data.message,
            isRollingBack: false,
            status: data.status,
            operationInProgress: false,
            progress,
            showNextButton: false
          });
        } else {
          // in_progress or initial
          const details = data.details || {
            isUpdating: false,
            updateComplete: false,
            updateSuccess: false,
            updateError: null
          };
          
          updateState({
            isInstalling: details.isUpdating,
            installationComplete: details.updateComplete,
            installationSuccess: details.updateSuccess,
            installationError: details.updateError || undefined,
            error: details.updateError || undefined,
            isRollingBack: false,
            status: data.status,
            operationInProgress: true,
            progress,
            showNextButton: false
          });
        }
      }
    }
  });

  return {
    state: otaSocket.state as OtaState,
    updateState: otaSocket.updateState,
    emit: otaSocket.emit
  };
}; 