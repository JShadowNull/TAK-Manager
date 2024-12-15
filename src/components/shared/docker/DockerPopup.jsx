import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Popup from '../Popup';
import Button from '../Button';

const DockerPopup = ({ isVisible }) => {
  const [dockerStatus, setDockerStatus] = useState({
    isInstalled: true,
    isRunning: false,
    error: null
  });
  const [isStartingDocker, setIsStartingDocker] = useState(false);

  // Initial Docker status check
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await axios.get('/docker-manager/docker/status');
        const { isInstalled, isRunning, error } = response.data;
        setDockerStatus({
          isInstalled,
          isRunning,
          error
        });
      } catch (error) {
        console.error('Error checking Docker status:', error);
        setDockerStatus(prev => ({
          ...prev,
          error: 'Error checking Docker status'
        }));
      }
    };
    checkInitialStatus();
  }, []);

  // Socket connection for real-time updates
  useEffect(() => {
    const socket = io('/docker-manager', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Connected to Docker manager socket');
    });

    socket.on('connect_error', (error) => {
      console.error('Docker manager socket connection error:', error);
    });

    socket.on('docker_status', (data) => {
      setDockerStatus({
        isInstalled: data.isInstalled,
        isRunning: data.isRunning,
        error: data.error || null
      });
      if (data.isRunning) {
        setIsStartingDocker(false);
      }
    });

    socket.on('docker_operation', (data) => {
      console.log('Docker operation result:', data);
      if (data.status === 'error') {
        setDockerStatus(prev => ({
          ...prev,
          error: data.message
        }));
        setIsStartingDocker(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleStartDocker = async () => {
    setIsStartingDocker(true);
    try {
      await axios.post('/docker-manager/docker/start');
    } catch (error) {
      console.error('Error starting Docker:', error);
      setDockerStatus(prev => ({
        ...prev,
        error: 'Failed to start Docker'
      }));
      setIsStartingDocker(false);
    }
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
            loadingText="Starting Docker..."
            variant="primary"
            className="hover:bg-green-500"
          >
            Start Docker
          </Button>
        ) : (
          <Button
            asChild
            variant="primary"
            className="hover:bg-green-500"
          >
            <a
              href="https://www.docker.com/products/docker-desktop/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Docker Desktop
            </a>
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