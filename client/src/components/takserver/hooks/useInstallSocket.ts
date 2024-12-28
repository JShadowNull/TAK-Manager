import useSocket, { BACKEND_EVENTS } from '../../shared/hooks/useSocket';
import { InstallState } from '../types';

type UpdateState = (state: Partial<InstallState>) => void;

export const useInstallSocket = () => {
  const installSocket = useSocket(BACKEND_EVENTS.TAKSERVER_INSTALLER.namespace, {
    initialState: {
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      installationError: undefined,
      error: undefined,
      isRollingBack: false,
      isStoppingInstallation: false,
      status: undefined,
      operationInProgress: false,
      dockerInstalled: false,
      progress: 0
    },
    eventHandlers: {
      handleTerminalOutput: true,
      onConnect: () => {
        console.log('Connected to installer service');
      },
      'operation_status': (data: { 
        operation: string, 
        status: string, 
        message: string, 
        details?: {
          isInstalling?: boolean,
          isStoppingInstallation?: boolean,
          installationComplete?: boolean,
          installationSuccess?: boolean,
          installationError?: string | null,
          version?: string | null,
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
            isInstalling: true,
            installationComplete: true,
            installationSuccess: true,
            installationError: undefined,
            error: undefined,
            isRollingBack: false,
            isStoppingInstallation: false,
            status: data.status,
            operationInProgress: false,
            progress: 100
          });
        } else if (data.status === 'failed') {
          updateState({
            isInstalling: true,
            installationComplete: true,
            installationSuccess: false,
            installationError: data.message,
            error: data.message,
            isRollingBack: false,
            isStoppingInstallation: false,
            status: data.status,
            operationInProgress: false,
            progress
          });
        } else {
          // in_progress or initial
          const details = data.details || {};
          updateState({
            isInstalling: details.isInstalling ?? true,
            isStoppingInstallation: details.isStoppingInstallation ?? false,
            installationComplete: details.installationComplete ?? false,
            installationSuccess: details.installationSuccess ?? false,
            installationError: details.installationError || undefined,
            error: details.installationError || undefined,
            isRollingBack: false,
            status: data.status,
            operationInProgress: true,
            progress
          });
        }
      },
      [BACKEND_EVENTS.TAKSERVER_INSTALLER.events.DOCKER_STATUS]: (data: InstallState, { updateState }: { updateState: UpdateState }) => {
        console.log('Docker Status:', data);
        updateState({
          dockerInstalled: data.dockerInstalled,
          error: data.error
        });
      }
    }
  });

  return {
    state: installSocket.state as InstallState,
    updateState: installSocket.updateState,
    emit: installSocket.emit
  };
}; 