import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
import DockerPopup from '../components/shared/ui/popups/DockerPopup';
import useSocket from '../components/shared/hooks/useSocket.js';
import useFetch from '../components/shared/hooks/useFetch.js';
import CustomScrollbar from '../components/shared/ui/CustomScrollbar';
import { Switch } from '../components/shared/ui/shadcn/switch';

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
  const { get, post, loading, error } = useFetch();

  // Define socket event handlers
  const dockerManagerHandlers = {
    docker_status: (data) => {
      console.log('Received Docker status:', data);
      setDockerStatus({
        isInstalled: data.isInstalled ?? true,
        isRunning: data.isRunning ?? false,
        error: data.error || null
      });
      
      // Reset loading states based on status
      if (data.isRunning) {
        setIsStartingDocker(false);
      } else {
        setIsStoppingDocker(false);
      }

      // If Docker is not running, clear containers
      if (!data.isRunning) {
        setContainers([]);
      }
    },
    containers: (data) => {
      console.log('Received containers update:', data.containers);
      if (Array.isArray(data.containers)) {
        setContainers(data.containers);
        
        // Clear pending actions for containers that reached target state
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
    },
    docker_operation: (data) => {
      console.log('Docker operation result:', data);
      if (data.status === 'error') {
        setDockerStatus(prev => ({
          ...prev,
          error: data.message
        }));
        setIsStartingDocker(false);
        setIsStoppingDocker(false);
      }
    },
    container_operation: (data) => {
      console.log('Container operation result:', data);
      if (data.status === 'error' && data.container) {
        setPendingContainerActions(prev => {
          const newPending = { ...prev };
          delete newPending[data.container];
          return newPending;
        });
      }
    },
    onConnect: () => {
      console.log('Connected to Docker manager socket');
      // Request immediate status update on connection
      dockerSocket.emit('check_status');
    },
    onError: (error) => {
      console.error('Docker manager socket connection error:', error);
      setDockerStatus(prev => ({
        ...prev,
        error: 'Connection error with Docker manager'
      }));
    }
  };

  // Initialize socket using the hook
  const dockerSocket = useSocket('/docker-manager', {
    eventHandlers: dockerManagerHandlers,
    options: {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    }
  });

  // Initial Docker status check
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const data = await get('/docker-manager/docker/status');
        const { isInstalled, isRunning, containers: containerList, error } = data;
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
  }, [get]);

  const handleDockerToggle = async (isChecked) => {
    if (isChecked) {
      setIsStartingDocker(true);
    } else {
      setIsStoppingDocker(true);
    }
    try {
      await post(`/docker-manager/docker/${isChecked ? 'start' : 'stop'}`);
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
      await post(`/docker-manager/docker/containers/${containerName}/${action}`);
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
    <div className="flex gap-6 flex-wrap">
      <div className="flex flex-wrap">
        {/* Start/Stop Services */}
        <div className="bg-card p-6 rounded-lg shadow-lg foreground w-full border border-border max-w-fit max-h-[8rem]">
          <h2 className="text-base mb-4 text-center">Start/Stop Services</h2>
          <div className="flex items-center justify-between px-2 gap-3">
            <Switch
              checked={dockerStatus.isRunning}
              onCheckedChange={handleDockerToggle}
              disabled={isStartingDocker || isStoppingDocker}
              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
            />
            <span className="text-sm foreground">
              {isStartingDocker ? 'Starting Docker...' :
               isStoppingDocker ? 'Stopping Docker...' :
               dockerStatus.isRunning ? 'Docker is running' : 'Docker is stopped'}
            </span>
          </div>
        </div>
      </div>

      {/* Docker Containers */}
      <div className="min-w-[31.5rem] w-1/2 bg-card p-6 rounded-lg shadow-lg foreground border border-border min-h-[20rem]">
        <h2 className="text-base mb-4 text-center">Docker Containers</h2>
        <div className="h-[calc(100%-3rem)]">
          <CustomScrollbar>
            <ul className="list-none space-y-2 divide-y divide-border text-sm p-2">
              {!dockerStatus.isInstalled ? (
                <li className="border-1 border-border p-4 rounded">Docker is not installed</li>
              ) : !dockerStatus.isRunning ? (
                <li className="border-1 border-border p-4 rounded">Start Docker to view containers</li>
              ) : containers.length === 0 ? (
                <li className="border-1 border-border p-4 rounded">No containers found</li>
              ) : (
                containers.map(container => {
                  const running = isContainerRunning(container.status);
                  const inTransition = isContainerInTransition(container.status, pendingContainerActions[container.name]);
                  
                  return (
                    <li key={container.name} className="p-4 rounded flex justify-between items-center space-x-4">
                      <span className="flex-grow">
                        Container: {container.name} (Status: {container.status})
                      </span>
                      <button
                        className={`focus:outline-none text-lg ${
                          inTransition
                            ? 'text-primary'
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
          </CustomScrollbar>
        </div>
      </div>

      {/* Docker Popup - only shown when Docker is not installed */}
      <DockerPopup 
        isVisible={!dockerStatus.isInstalled}
      />
    </div>
  );
}

export default Services; 