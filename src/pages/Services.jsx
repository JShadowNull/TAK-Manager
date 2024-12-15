import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import DockerPopup from '../components/shared/docker/DockerPopup';

// Create a styled Switch component using Tailwind-like styles
const StyledSwitch = styled(Switch)({
  '& .MuiSwitch-switchBase': {
    color: '#ffffff', // white
    '&.Mui-checked': {
      color: '#ffffff', // white
      '& + .MuiSwitch-track': {
        backgroundColor: '#22C55E', // green-500
        opacity: 1,
      },
    },
  },
  '& .MuiSwitch-track': {
    backgroundColor: '#EF4444', // red-500
    opacity: 1,
  },
});

function Services() {
  const [dockerStatus, setDockerStatus] = useState({
    isInstalled: true,
    isRunning: false,
    error: null
  });
  const [isStartingDocker, setIsStartingDocker] = useState(false);
  const [isStoppingDocker, setIsStoppingDocker] = useState(false);
  const [containers, setContainers] = useState([]);
  const [pendingContainerActions, setPendingContainerActions] = useState({});

  // Initial Docker status check
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await axios.get('/docker-manager/docker/status');
        const { isInstalled, isRunning, containers: containerList, error } = response.data;
        setDockerStatus({
          isInstalled,
          isRunning,
          error
        });
        if (containerList) {
          setContainers(containerList);
        }
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

    // Listen for Docker status updates
    socket.on('docker_status', (data) => {
      console.log('Received Docker status:', data);
      setDockerStatus({
        isInstalled: data.isInstalled,
        isRunning: data.isRunning,
        error: data.error || null
      });
      
      // Reset loading states based on status
      if (data.isRunning) {
        setIsStartingDocker(false);
      } else {
        setIsStoppingDocker(false);
      }
    });

    // Listen for container updates
    socket.on('containers', (data) => {
      console.log('Received containers update:', data.containers);
      setContainers(data.containers || []);
      
      // Clear pending actions for containers that reached target state
      if (data.containers) {
        setPendingContainerActions(prev => {
          const newPending = { ...prev };
          data.containers.forEach(container => {
            const pendingAction = newPending[container.name];
            const status = container.status.toLowerCase();
            
            if (pendingAction === 'start' && isContainerRunning(status)) {
              delete newPending[container.name];
            } else if (pendingAction === 'stop' && status.includes('exited')) {
              delete newPending[container.name];
            }
          });
          return newPending;
        });
      }
    });

    // Listen for Docker operation results
    socket.on('docker_operation', (data) => {
      console.log('Docker operation result:', data);
      if (data.status === 'error') {
        setDockerStatus(prev => ({
          ...prev,
          error: data.message
        }));
        setIsStartingDocker(false);
        setIsStoppingDocker(false);
      }
    });

    // Listen for container operation results
    socket.on('container_operation', (data) => {
      console.log('Container operation result:', data);
      if (data.status === 'error' && data.container) {
        setPendingContainerActions(prev => {
          const newPending = { ...prev };
          delete newPending[data.container];
          return newPending;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleDockerToggle = async (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      setIsStartingDocker(true);
    } else {
      setIsStoppingDocker(true);
    }
    try {
      await axios.post(`/docker-manager/docker/${isChecked ? 'start' : 'stop'}`);
    } catch (error) {
      console.error('Error toggling Docker:', error);
      setDockerStatus(prev => ({
        ...prev,
        error: `Error ${isChecked ? 'starting' : 'stopping'} Docker`
      }));
      setIsStartingDocker(false);
      setIsStoppingDocker(false);
    }
  };

  const toggleContainer = async (containerName, action) => {
    console.log(`Toggling container ${containerName} with action ${action}`);
    setPendingContainerActions(prev => ({
      ...prev,
      [containerName]: action
    }));
    try {
      await axios.post(`/docker-manager/docker/containers/${containerName}/${action}`);
    } catch (error) {
      console.error(`Error ${action}ing container:`, error);
      setPendingContainerActions(prev => {
        const newPending = { ...prev };
        delete newPending[containerName];
        return newPending;
      });
    }
  };

  const isContainerRunning = (status) => {
    const lowerStatus = status.toLowerCase();
    return lowerStatus.includes('up') || 
           lowerStatus.includes('running') ||
           lowerStatus.includes('(healthy)') ||
           lowerStatus.includes('(unhealthy)');
  };

  const isContainerInTransition = (status, pendingAction) => {
    if (!status || !pendingAction) return false;
    
    const lowerStatus = status.toLowerCase();
    
    if (pendingAction === 'start' && !isContainerRunning(status)) {
      return true;
    }
    
    if (pendingAction === 'stop' && isContainerRunning(status)) {
      return true;
    }
    
    return false;
  };

  return (
    <div className="flex gap-8 pt-14">
      <div className="flex flex-col gap-8 w-1/3">
        {/* Start/Stop Services */}
        <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white w-full border-1 border-accentBoarder">
          <h2 className="text-base mb-4 text-center">Start/Stop Services</h2>
          <div className="flex items-center justify-between px-2">
            <FormControlLabel
              className="m-0" // Override MUI margin
              control={
                <StyledSwitch
                  checked={dockerStatus.isRunning}
                  onChange={handleDockerToggle}
                  disabled={isStartingDocker || isStoppingDocker}
                  className="mr-3"
                />
              }
              label={
                <span className="text-sm text-white">
                  {isStartingDocker ? 'Starting Docker...' :
                   isStoppingDocker ? 'Stopping Docker...' :
                   dockerStatus.isRunning ? 'Docker is running' : 'Docker is stopped'}
                </span>
              }
              labelPlacement="end"
            />
          </div>
        </div>
      </div>

      {/* Docker Containers */}
      <div className="w-2/3 bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
        <h2 className="text-base mb-4 text-center">Docker Containers</h2>
        <ul className="list-none space-y-2 text-sm">
          {!dockerStatus.isInstalled ? (
            <li className="border-1 border-accentBoarder p-4 rounded">Docker is not installed</li>
          ) : !dockerStatus.isRunning ? (
            <li className="border-1 border-accentBoarder p-4 rounded">Start Docker to view containers</li>
          ) : containers.length === 0 ? (
            <li className="border-1 border-accentBoarder p-4 rounded">No containers found</li>
          ) : (
            containers.map(container => {
              const running = isContainerRunning(container.status);
              const inTransition = isContainerInTransition(container.status, pendingContainerActions[container.name]);
              
              return (
                <li key={container.name} className="p-4 rounded flex justify-between items-center space-x-4 border-1 border-accentBoarder">
                  <span className="flex-grow">
                    Container: {container.name} (Status: {container.status})
                  </span>
                  <button
                    className={`focus:outline-none text-lg ${
                      inTransition
                        ? 'text-gray-500'
                        : running
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-green-500 hover:text-green-600'
                    }`}
                    disabled={inTransition}
                    onClick={() => {
                      const action = running ? 'stop' : 'start';
                      toggleContainer(container.name, action);
                    }}
                  >
                    {inTransition ? (
                      <FontAwesomeIcon 
                        icon={faSpinner} 
                        className="animate-spin"
                      />
                    ) : running ? (
                      <FontAwesomeIcon icon={faStop} />
                    ) : (
                      <FontAwesomeIcon icon={faPlay} />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Docker Popup - only shown when Docker is not installed */}
      <DockerPopup 
        isVisible={!dockerStatus.isInstalled}
      />
    </div>
  );
}

export default Services; 