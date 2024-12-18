import type { FC } from 'react';
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
    updateState
  } = useSocket('/docker-manager', {
    initialState: {
      isInstalled: false,
      isRunning: false,
      dockerRunning: false,
      isLoading: false,
      status: null,
      operationInProgress: false
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
            dockerRunning: data.dockerRunning || false
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
          status: data.status
        };
        
        updateState(newState);
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
          status: 'starting'
        };
        
        updateState(newState);
        await post<{ status?: string }>('/docker-manager/docker/start');
        emit('check_status');
      } catch (error) {
        console.error('Error starting Docker:', error);
        updateState({
          ...dockerState,
          isLoading: false,
          operationInProgress: false
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
            Checking Docker status...
          </p>
        ) : dockerState.isInstalled ? (
          <p className="text-primary">
            Docker Desktop must be running to use TAK Server. Click the button below to start Docker.
          </p>
        ) : (
          <>
            <p className="text-primary">
              TAK Server requires Docker Desktop to run. Please install Docker Desktop to continue.
            </p>
          </>
        )}
      </div>
    </Popup>
  );
};

export default DockerPopup; 