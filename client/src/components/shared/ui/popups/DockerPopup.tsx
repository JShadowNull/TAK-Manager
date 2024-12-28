import type { FC } from 'react';
import Popup from './Popup';
import LoadingButton from '../inputs/LoadingButton';
import useSocket, { BACKEND_EVENTS } from '../../hooks/useSocket';
import useFetch from '../../hooks/useFetch';

interface DockerPopupProps {
  isVisible: boolean;
}

const DockerPopup: FC<DockerPopupProps> = ({ isVisible }) => {
  const { post } = useFetch();

  const {
    state: dockerState,
    isConnected,
    emit,
    updateState,
    error
  } = useSocket(BACKEND_EVENTS.DOCKER_MANAGER.namespace, {
    initialState: {
      isInstalled: false,
      isRunning: false,
      dockerRunning: false,
      isLoading: true,
      status: null,
      operationInProgress: false,
      error: null
    },
    eventHandlers: {
      'initial_state': (data, { updateState }) => {
        console.log('DockerPopup received initial state:', data);
        updateState({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          dockerRunning: data.isRunning || false,
          isLoading: false,
          error: data.error || null,
          containers: data.containers || [],
          operationInProgress: false
        });
      },
      [BACKEND_EVENTS.DOCKER_MANAGER.events.STATUS_UPDATE]: (data, { state, updateState }) => {
        console.log('DockerPopup received docker status:', data);
        // Only update if not in a loading state
        if (!state.operationInProgress) {
          updateState({
            ...state,
            isInstalled: data.isInstalled,
            isRunning: data.isRunning,
            dockerRunning: data.dockerRunning || false,
            isLoading: false,
            error: null,
            containers: state.containers || []
          });
        }
      },
      [BACKEND_EVENTS.DOCKER_MANAGER.events.DOCKER_OPERATION]: (data, { state, updateState }) => {
        console.log('Docker Operation Event Received:', data);
        
        const isComplete = data.status === 'complete';
        const newState = {
          ...state,
          isInstalled: state.isInstalled,
          isRunning: data.isRunning !== undefined ? data.isRunning : state.isRunning,
          operationInProgress: !isComplete,
          isLoading: !isComplete,
          status: data.status,
          error: data.error || null,
          containers: state.containers || []
        };
        
        updateState(newState);

        // Request fresh status after operation completes
        if (isComplete) {
          emit('check_status');
        }
      }
    }
  });

  const handleStartDocker = async (): Promise<void> => {
    if (!dockerState.operationInProgress) {
      try {
        const newState = {
          ...dockerState,
          isLoading: true,
          operationInProgress: true,
          status: 'starting',
          error: null
        };
        
        updateState(newState);
        await post<{ status?: string }>('/docker-manager/docker/start');
        emit('check_status');
      } catch (error) {
        console.error('Error starting Docker:', error);
        updateState({
          ...dockerState,
          isLoading: false,
          operationInProgress: false,
          error: error instanceof Error ? error.message : 'Failed to start Docker'
        });
      }
    }
  };

  const shouldShowPopup = isVisible && (!dockerState.isInstalled || !dockerState.isRunning);
  const isButtonDisabled = dockerState.dockerRunning || dockerState.operationInProgress || !isConnected;

  const getButtonText = (): string => {
    if (!isConnected) return 'Connecting...';
    if (dockerState.operationInProgress) {
      return dockerState.status === 'starting' ? 'Starting Docker Desktop...' : 'Stopping Docker Desktop...';
    }
    if (dockerState.dockerRunning) return 'Docker Running';
    return 'Start Docker';
  };

  // Show error state if socket has an error, but not for expected Docker daemon not running state
  const errorMessage = error?.message || dockerState.error;
  const isUnexpectedError = errorMessage && errorMessage !== 'Docker daemon is not running';
  
  if (!shouldShowPopup) {
    return null;
  }

  if (isUnexpectedError) {
    return (
      <Popup
        id="docker-error-popup"
        title="Docker Connection Error"
        isVisible={true}
        onClose={() => {}}
        variant="standard"
        blurSidebar={false}
      >
        <div className="text-center text-red-500">
          <p>{errorMessage}</p>
        </div>
      </Popup>
    );
  }

  return (
    <Popup
      id="docker-error-popup"
      title={dockerState.isInstalled ? "Docker Not Running" : "Docker Required"}
      isVisible={isVisible}
      onClose={() => {}}
      variant="standard"
      blurSidebar={false}
      buttons={
        dockerState.isInstalled ? (
          <LoadingButton
            onClick={handleStartDocker}
            operation="start"
            isLoading={dockerState.operationInProgress}
            status={dockerState.status === 'complete' ? 'complete' : dockerState.status === 'failed' ? 'failed' : null}
            loadingMessage="Starting Docker Desktop..."
            variant="primary"
            className="hover:bg-green-500"
            disabled={isButtonDisabled}
          >
            {getButtonText()}
          </LoadingButton>
        ) : (
          <LoadingButton
            variant="primary"
            className="hover:bg-green-500"
            href="https://www.docker.com/products/docker-desktop/"
            target="_blank"
            operation="install"
            isLoading={false}
          >
            Download Docker Desktop
          </LoadingButton>
        )
      }
    >
      <div className="text-center">
        {!isConnected ? (
          <p className="text-primary">
            Connecting to Docker service...
          </p>
        ) : dockerState.isLoading ? (
          <p className="text-primary">
            Checking Docker status...
          </p>
        ) : dockerState.isInstalled ? (
          <p className="text-primary">
            Docker Desktop must be running to use TAK Server. Click the button below to start Docker.
          </p>
        ) : (
          <p className="text-primary">
            TAK Server requires Docker Desktop to run. Please install Docker Desktop to continue.
          </p>
        )}
      </div>
    </Popup>
  );
};

export default DockerPopup; 