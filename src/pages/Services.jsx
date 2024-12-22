import React, { useEffect, useState } from 'react';
import DockerPopup from '../components/shared/ui/popups/DockerPopup';
import useSocket, { BACKEND_EVENTS } from '../components/shared/hooks/useSocket';
import useFetch from '../components/shared/hooks/useFetch';
import CustomScrollbar from '../components/shared/ui/CustomScrollbar';
import { LoadingSwitch } from '../components/shared/ui/LoadingSwitch';
import { useLoader } from '../components/shared/hooks/useLoader';
import ContainerStateIcon from '../components/shared/ui/ContainerStateIcon';

const INITIAL_DOCKER_STATE = {
  isInstalled: false,
  isRunning: false,
  dockerRunning: false,
  error: null,
  containers: [],
  status: null
};

function Services() {
  const { post } = useFetch();
  const [dockerOperation, setDockerOperation] = useState('start');
  const {
    state: dockerState = INITIAL_DOCKER_STATE,
    isConnected,
    error: dockerError,
    updateState,
    emit
  } = useSocket(BACKEND_EVENTS.DOCKER_MANAGER.namespace, {
    initialState: INITIAL_DOCKER_STATE,
    eventHandlers: {
      // Initial state handling
      'initial_state': (data, { updateState }) => {
        console.info('Received initial state:', data);
        const newState = {
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          containers: data.containers || [],
          error: data.error || null
        };
        updateState(newState);
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
        
        const newState = {
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          error: data.error || null
        };
        updateState(newState);

        // If Docker is running but we have no containers, request container list
        if (data.isRunning && (!state.containers || state.containers.length === 0)) {
          console.info('Docker is running but no containers found, requesting container list');
          emit('check_status');
        }
      },
      
      // Container list updates
      [BACKEND_EVENTS.DOCKER_MANAGER.events.CONTAINERS_LIST]: (data, { updateState }) => {
        console.info('Received containers update:', data);
        
        if (Array.isArray(data.containers)) {
          updateState({
            containers: data.containers,
            error: null
          });
        }
      }
    }
  });

  const { 
    isLoading, 
    message, 
    progress, 
    status,
    error: operationError,
    executeWithLoading 
  } = useLoader({
    namespace: BACKEND_EVENTS.DOCKER_MANAGER.namespace,
    operationType: dockerOperation,
    targetId: 'docker',
    onComplete: () => {
      updateState({ status: null });
      // Update operation type based on new state
      setDockerOperation(dockerState.isRunning ? 'stop' : 'start');
    },
    onError: (error) => {
      updateState({ 
        error,
        status: null 
      });
      // Reset operation type on error
      setDockerOperation(dockerState.isRunning ? 'stop' : 'start');
    },
    operation: async (targetId, operationType) => {
      const response = await post(`/docker-manager/docker/${operationType}`);
      if (response.error) {
        throw new Error(response.error);
      }
      return response;
    }
  });

  // Update operation type whenever Docker state changes
  React.useEffect(() => {
    setDockerOperation(dockerState.isRunning ? 'stop' : 'start');
  }, [dockerState.isRunning]);

  // Debug logging effect
  React.useEffect(() => {
    console.info('Docker state updated:', {
      isConnected,
      dockerState,
      error: dockerError,
      operation: dockerOperation
    });
  }, [isConnected, dockerState, dockerError, dockerOperation]);

  const handleDockerToggle = async () => {
    if (isLoading) return;

    // Determine the operation based on current state
    const operation = dockerState.isRunning ? 'stop' : 'start';
    console.debug('Docker Toggle called:', {
      operation,
      currentState: dockerState
    });

    try {
      const operationText = operation === 'stop' ? 'Stopping' : 'Starting';
      await executeWithLoading({
        loadingMessage: `${operationText} Docker...`,
        successMessage: `Docker ${operation}ed successfully`,
        errorMessage: `Error ${operation}ing Docker`
      });
    } catch (error) {
      console.error('Docker Toggle Error:', error);
    }
  };

  const isContainerRunning = (status) => {
    const lowerStatus = status.toLowerCase();
    return lowerStatus.includes('up') || 
           lowerStatus.includes('running') ||
           lowerStatus.includes('(healthy)') ||
           lowerStatus.includes('(unhealthy)');
  };

  // Render loading state if not connected
  if (!isConnected) {
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
      <h2 className="text-base mb-4 text-medium text-center">Start/Stop Services</h2>
      <div className="flex items-center justify-start px-2 gap-3">
        <LoadingSwitch
          checked={dockerState.isRunning}
          onCheckedChange={handleDockerToggle}
          operation={dockerOperation}
          isLoading={isLoading}
          status={status}
          message={message}
          progress={progress}
          error={operationError}
          showProgress={true}
          showLoadingState={true}
          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
          runningMessage="Docker is running"
          stoppedMessage="Docker is stopped"
          failedMessage="Docker operation failed"
          loadingMessage={message}
        />
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
        <h2 className="text-base mb-4 text-medium text-center">Docker Containers</h2>
        <div className="h-[calc(100%-3rem)]">
          <CustomScrollbar>
            <ul className="list-none space-y-2 divide-y divide-border text-sm text-muted-foreground p-2">
              {!dockerState.isInstalled ? (
                <li className="border-1 border-border p-4 rounded">Docker is not installed</li>
              ) : !dockerState.isRunning ? (
                <li className="border-1 border-border p-4 rounded">Start Docker to view containers</li>
              ) : dockerState.containers.length === 0 ? (
                <li className="border-1 border-border p-4 rounded">No containers found</li>
              ) : (
                dockerState.containers.map(container => {
                  const running = isContainerRunning(container.status);
                  return (
                    <li key={container.name} className="p-4 rounded flex justify-between items-center space-x-4">
                      <span className="flex-grow">
                        Container: {container.name} (Status: {container.status})
                      </span>
                      <ContainerStateIcon
                        containerName={container.name}
                        isRunning={running}
                        disabled={!dockerState.isRunning}
                        onOperation={async (containerName, action) => {
                          console.debug('[Services] Container operation:', {
                            containerName,
                            action
                          });
                          try {
                            const response = await post(`/docker-manager/docker/containers/${containerName}/${action}`);
                            console.debug('[Services] Operation response:', response);
                            return response;
                          } catch (error) {
                            console.error('[Services] Operation failed:', error);
                            throw error;
                          }
                        }}
                        onOperationComplete={() => emit('check_status')}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </CustomScrollbar>
        </div>
      </div>

      {/* Docker Popup */}
      <DockerPopup 
        isVisible={!dockerState.isInstalled}
      />
    </div>
  );
}

export default Services; 