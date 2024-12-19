import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
import DockerPopup from '../components/shared/ui/popups/DockerPopup';
import useSocket, { BACKEND_EVENTS } from '../components/shared/hooks/useSocket';
import useFetch from '../components/shared/hooks/useFetch';
import CustomScrollbar from '../components/shared/ui/CustomScrollbar';
import { LoadingSwitch } from '../components/shared/ui/LoadingSwitch';
import { useOperationStatus } from '../components/shared/hooks/useOperationStatus';
import { cn } from '../lib/utils';

function Services() {
  const { post } = useFetch();
  const { isOperationInProgress, operationState, subscribeToOperationStatus } = useOperationStatus(BACKEND_EVENTS.DOCKER_MANAGER.namespace);

  // Docker Manager Socket
  const {
    state: dockerState,
    isConnected,
    error: dockerError,
    updateState,
    emit
  } = useSocket(BACKEND_EVENTS.DOCKER_MANAGER.namespace, {
    initialState: {
      isInstalled: false,
      isRunning: false,
      dockerRunning: false,
      error: null,
      containers: [],
      pendingActions: {},
      isLoading: false,
      status: null,
      operationInProgress: false
    },
    eventHandlers: {
      // Initial state handling
      'initial_state': (data, { updateState }) => {
        console.info('Received initial state:', data);
        updateState({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          containers: data.containers || [],
          error: data.error || null
        });
      },
      
      onConnect: () => {
        console.log('Docker Manager socket connected');
      },
      
      // Regular status updates
      [BACKEND_EVENTS.DOCKER_MANAGER.events.STATUS_UPDATE]: (data, { state, updateState }) => {
        console.info('Docker Status:', {
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          error: data.error,
          currentState: state
        });
        
        // Only update status-related fields, preserve containers and other state
        if (!isOperationInProgress(state.status === 'stopping' ? 'stop' : 'start') &&
            (state.isInstalled !== data.isInstalled || 
             state.isRunning !== data.isRunning || 
             state.error !== data.error)) {
          
          // If Docker is running but we have no containers, request container list
          if (data.isRunning && (!state.containers || state.containers.length === 0)) {
            console.info('Docker is running but no containers found, requesting container list');
            emit('check_status');
          }
          
          updateState({
            isInstalled: data.isInstalled,
            isRunning: data.isRunning,
            error: data.error || null
          });
        }
      },
      
      // Operation status updates (start/stop progress)
      [BACKEND_EVENTS.DOCKER_MANAGER.events.DOCKER_OPERATION]: (data, { state, updateState }) => {
        console.info('Docker Operation:', {
          status: data.status,
          isRunning: data.isRunning
        });
        
        const isComplete = data.status === 'complete';
        
        // Only update operation-related fields
        updateState({
          isRunning: data.isRunning !== undefined ? data.isRunning : state.isRunning,
          error: data.error || null,
          status: isComplete ? null : (
            state.status === 'stopping' || data.status === 'stopping' ? 'stopping' : 'starting'
          )
        });
        
        // If operation is complete and Docker is running, request container list
        if (isComplete && data.isRunning) {
          emit('check_status');
        }
      },

      // Container updates
      [BACKEND_EVENTS.DOCKER_MANAGER.events.CONTAINERS_LIST]: (data, { state, updateState }) => {
        console.info('Received containers update:', data);
        
        if (Array.isArray(data.containers)) {
          const newPendingActions = { ...state.pendingActions };
          
          data.containers.forEach(container => {
            const pendingAction = newPendingActions[container.name];
            const status = container.status.toLowerCase();
            
            if (pendingAction === 'start' && isContainerRunning(status)) {
              delete newPendingActions[container.name];
            } else if (pendingAction === 'stop' && status.includes('exited')) {
              delete newPendingActions[container.name];
            }
          });

          // Update state with new containers and pending actions
          updateState({
            containers: data.containers,
            pendingActions: newPendingActions,
            error: null
          });
          
          console.info('Updated containers state:', {
            containers: data.containers,
            pendingActions: newPendingActions
          });
        }
      },

      [BACKEND_EVENTS.DOCKER_MANAGER.events.CONTAINER_OPERATION]: (data, { state, updateState }) => {
        console.info('Container operation update:', data);
        if (data.container && data.status) {
          updateState({
            pendingActions: {
              ...state.pendingActions,
              [data.container]: data.status === 'complete' ? undefined : data.status
            }
          });
        }
      }
    }
  });

  // Subscribe to operation status events when component mounts
  React.useEffect(() => {
    const unsubscribe = subscribeToOperationStatus();
    return () => unsubscribe();
  }, [subscribeToOperationStatus]);

  // Debug logging effect - moved to top level
  React.useEffect(() => {
    console.info('Docker state updated:', {
      isConnected,
      dockerState,
      error: dockerError
    });
  }, [isConnected, dockerState, dockerError]);

  const handleDockerToggle = async (isChecked) => {
    console.debug('Docker Toggle called:', {
      isChecked,
      currentState: dockerState,
      operationState
    });

    try {
      // Only update status-related fields
      updateState({
        error: null,
        status: isChecked ? 'starting' : 'stopping'
      });
      
      await post(`/docker-manager/docker/${isChecked ? 'start' : 'stop'}`);
    } catch (error) {
      console.error('Docker Toggle Error:', error);
      updateState({
        error: `Error ${isChecked ? 'starting' : 'stopping'} Docker`,
        status: null
      });
    }
  };

  const toggleContainer = async (containerName, action) => {
    console.info('Container Toggle:', { container: containerName, action });
    
    // Only update pending actions
    updateState({
      pendingActions: {
        ...dockerState.pendingActions,
        [containerName]: action
      }
    });

    try {
      await post(`/docker-manager/docker/containers/${containerName}/${action}`);
    } catch (error) {
      console.error('Container Toggle Error:', error);
      // Clear only the pending action on error
      updateState({
        pendingActions: {
          ...dockerState.pendingActions,
          [containerName]: undefined
        }
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

  const isContainerInTransition = (container) => {
    const pendingAction = dockerState.pendingActions[container.name];
    if (!pendingAction) return false;
    
    const status = container.status.toLowerCase();
    
    if (pendingAction === 'start' && !isContainerRunning(status)) {
      return true;
    }
    
    if (pendingAction === 'stop' && isContainerRunning(status)) {
      return true;
    }
    
    return false;
  };

  // Render loading state if not connected
  if (!isConnected) {
    console.info('Waiting for socket connection...');
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Connecting to Docker service...</h2>
          <p className="text-muted-foreground">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  const dockerSwitchSection = (
    <div className="bg-card p-6 rounded-lg shadow-lg foreground w-full border border-border max-w-fit max-h-[8rem]">
      <h2 className="text-base mb-4 text-center">Start/Stop Services</h2>
      <div className="flex items-center justify-between px-2 gap-3">
        <LoadingSwitch
          checked={dockerState.isRunning}
          onCheckedChange={handleDockerToggle}
          operation={dockerState.status === 'stopping' ? 'stop' : 'start'}
          isLoading={
            operationState?.status === 'in_progress' || 
            dockerState.status === 'starting' || 
            dockerState.status === 'stopping'
          }
          status={operationState?.status}
          message={
            dockerState.status === 'starting' || (operationState?.status === 'in_progress' && !dockerState.isRunning) 
              ? 'Starting Docker...' 
              : dockerState.status === 'stopping' || (operationState?.status === 'in_progress' && dockerState.isRunning)
              ? 'Stopping Docker...'
              : undefined
          }
          showProgress={false}
          showLoadingState={true}
          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
        />
        {!(operationState?.status === 'in_progress' || 
           dockerState.status === 'starting' || 
           dockerState.status === 'stopping') && (
          <span className="text-sm foreground">
            {dockerState.isRunning ? 'Docker is running' : 'Docker is stopped'}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 flex-wrap">
      <div className="flex flex-wrap">
        {dockerSwitchSection}
      </div>

      {/* Docker Containers */}
      <div className="min-w-[31.5rem] w-1/2 bg-card p-6 rounded-lg shadow-lg foreground border border-border min-h-[20rem]">
        <h2 className="text-base mb-4 text-center">Docker Containers</h2>
        <div className="h-[calc(100%-3rem)]">
          <CustomScrollbar>
            <ul className="list-none space-y-2 divide-y divide-border text-sm p-2">
              {!dockerState.isInstalled && !dockerState.isLoading ? (
                <li className="border-1 border-border p-4 rounded">Docker is not installed</li>
              ) : !dockerState.isRunning ? (
                <li className="border-1 border-border p-4 rounded">Start Docker to view containers</li>
              ) : dockerState.containers.length === 0 ? (
                <li className="border-1 border-border p-4 rounded">No containers found</li>
              ) : (
                dockerState.containers.map(container => {
                  const running = isContainerRunning(container.status);
                  const inTransition = isContainerInTransition(container);
                  
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
                        disabled={inTransition || !dockerState.isRunning}
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

      {/* Docker Popup - only show when Docker is not installed and not loading */}
      <DockerPopup 
        isVisible={!dockerState.isInstalled && !dockerState.isLoading}
      />
    </div>
  );
}

export default Services; 