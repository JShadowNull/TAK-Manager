import type { FC } from 'react';
import { useEffect } from 'react';
import Popup from './Popup';
import Button from '../Button';
import useSocket from '../../hooks/useSocket';
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
  } = useSocket('/docker-manager', {
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
      docker_status: (data, { state, updateState }) => {
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
      docker_operation: (data, { state, updateState }) => {
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
      },
      error: (data, { updateState, state }) => {
        // Don't treat Docker daemon not running as an error
        if (data.message === 'Docker daemon is not running') {
          updateState({ 
            ...state,
            isLoading: false,
            operationInProgress: false,
            isRunning: false,
            dockerRunning: false
          });
          return;
        }

        console.error('Docker manager error:', data.message);
        updateState({ 
          ...state,
          error: data.message,
          isLoading: false,
          operationInProgress: false 
        });
      }
    }
  });

  // Request status when socket connects
  useEffect(() => {
    if (isConnected) {
      emit('check_status');
    }
  }, [isConnected, emit]);

  // Request status when popup becomes visible
  useEffect(() => {
    if (isVisible && isConnected) {
      emit('check_status');
    }
  }, [isVisible, isConnected, emit]);

  // Periodically request status while visible
  useEffect(() => {
    if (!isVisible || !isConnected) return;

    const intervalId = setInterval(() => {
      if (!dockerState.operationInProgress) {
        emit('check_status');
      }
    }, 2000); // Check every 2 seconds like Dashboard

    return () => clearInterval(intervalId);
  }, [isVisible, isConnected, emit, dockerState.operationInProgress]);

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
  
  if (isUnexpectedError) {
    return (
      <Popup
        id="docker-error-popup"
        title="Docker Connection Error"
        isVisible={isVisible}
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
          <Button
            onClick={handleStartDocker}
            loading={dockerState.operationInProgress}
            loadingText="Starting Docker Desktop..."
            variant="primary"
            className="hover:bg-green-500"
            disabled={isButtonDisabled}
          >
            {getButtonText()}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="hover:bg-green-500"
            href="https://www.docker.com/products/docker-desktop/"
            target="_blank"
          >
            Download Docker Desktop
          </Button>
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