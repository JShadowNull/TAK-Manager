import React, { useState } from 'react';
import Popup from '../Popup';
import Button from '../Button';
import useSocket from '../../../hooks/useSocket';
import useFetch from '../../../hooks/useFetch';

const DockerPopup = ({ isVisible }) => {
  const [isStartingDocker, setIsStartingDocker] = useState(false);
  const { post } = useFetch();

  const {
    state: dockerStatus,
    updateState,
    error: socketError,
    isConnected
  } = useSocket('/docker-manager', {
    initialState: {
      isInstalled: true,
      isRunning: false,
      error: null
    },
    eventHandlers: {
      onConnect: () => {
        console.log('Connected to Docker manager socket');
      },
      onError: (error) => {
        console.error('Docker manager socket connection error:', error);
        updateState({ error: 'Connection error: ' + error.message });
      },
      docker_status: (data) => {
        if (data.isRunning) {
          updateState({
            isInstalled: data.isInstalled,
            isRunning: true,
            error: null
          });
          if (isStartingDocker) {
            setIsStartingDocker(false);
          }
        } else {
          updateState({
            isInstalled: data.isInstalled,
            isRunning: false,
            error: data.error || null
          });
        }
      },
      docker_operation: (data) => {
        console.log('Docker operation result:', data);
        if (data.status === 'error') {
          updateState({ error: data.message });
          setIsStartingDocker(false);
        } else if (data.status === 'success') {
          console.log('Docker operation successful:', data.message);
        }
      }
    }
  });

  const handleStartDocker = async () => {
    if (!isStartingDocker) {
      setIsStartingDocker(true);
      try {
        const response = await post('/docker-manager/docker/start');
        console.log('Start Docker response:', response);
        if (response.error && !response.status) {
          updateState({ error: response.error });
          setIsStartingDocker(false);
        }
      } catch (error) {
        console.error('Error starting Docker:', error);
        updateState({
          error: 'Failed to start Docker'
        });
        setIsStartingDocker(false);
      }
    }
  };

  const isButtonDisabled = dockerStatus.isRunning || isStartingDocker;

  const getLoadingText = () => {
    if (isStartingDocker) {
      return 'Starting Docker Desktop...';
    }
    if (dockerStatus.error) {
      return 'Error starting Docker';
    }
    return 'Start Docker';
  };

  return (
    <Popup
      id="docker-error-popup"
      title={dockerStatus.isInstalled ? "Docker Not Running" : "Docker Required"}
      isVisible={isVisible}
      onClose={() => {}}
      variant="standard"
      blurSidebar={false}
      buttons={
        dockerStatus.isInstalled ? (
          <Button
            onClick={handleStartDocker}
            loading={isStartingDocker}
            loadingText={getLoadingText()}
            variant="primary"
            className="hover:bg-green-500"
            disabled={isButtonDisabled}
          >
            {dockerStatus.isRunning ? 'Docker Running' : 'Start Docker'}
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
        {dockerStatus.isInstalled ? (
          <>
            <p className="text-yellow-500 font-semibold">
              Docker Desktop is not running
            </p>
            <p className="text-sm text-gray-300">
              Docker Desktop must be running to use TAK Server. Click the button below to start Docker.
            </p>
          </>
        ) : (
          <>
            <p className="text-yellow-500 font-semibold">
              Docker Desktop is required
            </p>
            <p className="text-sm text-gray-300">
              TAK Server requires Docker Desktop to run. Please install Docker Desktop to continue.
            </p>
          </>
        )}
      </div>
    </Popup>
  );
};

export default DockerPopup; 