import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';

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
  const [dockerStatus, setDockerStatus] = useState('Checking Docker status...');
  const [isDockerRunning, setIsDockerRunning] = useState(false);
  const [containers, setContainers] = useState([]);
  const [pendingContainerActions, setPendingContainerActions] = useState({});
  const [dockerSocket, setDockerSocket] = useState(null);

  useEffect(() => {
    // Connect to the Docker Manager namespace via Socket.IO
    const socket = io('/docker-manager', { transports: ['websocket'] });
    setDockerSocket(socket);

    // Socket event listeners
    socket.on('docker_status', (data) => {
      setIsDockerRunning(data.docker_running);
      setDockerStatus(data.docker_running ? 'Docker is running' : 'Docker is stopped');
      if (data.docker_running) {
        socket.emit('list_containers');
      }
    });

    socket.on('containers', (data) => {
      console.log('Received containers update:', data.containers);
      setContainers(data.containers || []);
      
      // Clear pending actions for any containers that have reached their target state
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

    socket.on('container_status_update', (data) => {
      console.log('Received status update:', data);
      
      setContainers(prevContainers => 
        prevContainers.map(container => 
          container.name === data.container_name 
            ? { ...container, status: data.status }
            : container
        )
      );

      // Only clear pending action if the container has reached its target state
      const status = data.status.toLowerCase();
      setPendingContainerActions(prev => {
        const newPending = { ...prev };
        const pendingAction = newPending[data.container_name];
        
        if (pendingAction === 'start' && isContainerRunning(status)) {
          delete newPending[data.container_name];
        } else if (pendingAction === 'stop' && status.includes('exited')) {
          delete newPending[data.container_name];
        }
        
        return newPending;
      });
    });

    // Request initial Docker status
    socket.emit('check_docker_status');

    // Set up periodic container list refresh
    const refreshInterval = setInterval(() => {
      if (isDockerRunning) {
        socket.emit('list_containers');
      }
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
    };
  }, [isDockerRunning]);

  const handleDockerToggle = (e) => {
    const isChecked = e.target.checked;
    setDockerStatus(isChecked ? 'Starting Docker...' : 'Stopping Docker...');
    dockerSocket.emit(isChecked ? 'start_docker' : 'stop_docker');
  };

  const toggleContainer = (containerName, action) => {
    console.log(`Toggling container ${containerName} with action ${action}`);
    setPendingContainerActions(prev => ({
      ...prev,
      [containerName]: action
    }));
    dockerSocket.emit(`${action}_container`, { container_name: containerName });
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
    
    // If there's a pending start action and the container isn't running
    if (pendingAction === 'start' && !isContainerRunning(status)) {
      return true;
    }
    
    // If there's a pending stop action and the container is running
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
                  checked={isDockerRunning}
                  onChange={handleDockerToggle}
                  disabled={dockerStatus.includes('Starting') || dockerStatus.includes('Stopping')}
                  className="mr-3"
                />
              }
              label={
                <span className="text-sm text-white">
                  {dockerStatus}
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
          {!isDockerRunning ? (
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
    </div>
  );
}

export default Services; 