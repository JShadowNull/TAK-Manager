import React from 'react';
import TakServerStatus from '../components/takserver/TakServerStatus';
import AdvancedFeatures from '../components/takserver/AdvancedFeatures';
import Configuration from '../components/takserver/Configuration';
import useSocket, { BACKEND_EVENTS } from '../components/shared/hooks/useSocket';

// TypeScript interfaces
export interface TakServerState {
  isInstalled: boolean;
  isRunning: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isRestarting: boolean;
  error: string | undefined;
  dockerRunning: boolean;
  version: string | undefined;
  status: string | undefined;
  operationInProgress: boolean;
}

interface SocketEventData {
  isInstalled: boolean;
  isRunning: boolean;
  dockerRunning: boolean;
  version?: string;
  error?: string;
  status?: string;
  isStarting?: boolean;
  isStopping?: boolean;
  isRestarting?: boolean;
  operationInProgress?: boolean;
}

const Takserver: React.FC = () => {
  // Use socket to track TAK server installation status
  const takSocket = useSocket(BACKEND_EVENTS.TAKSERVER_STATUS.namespace, {
    initialState: {
      isInstalled: false,
      isRunning: false,
      isStarting: false,
      isStopping: false,
      isRestarting: false,
      error: undefined,
      dockerRunning: false,
      version: undefined,
      status: undefined,
      operationInProgress: false
    },
    eventHandlers: {
      'initial_state': (data: SocketEventData, { updateState }) => {
        console.log('Received TAK Server initial state:', data);
        const isOperationInProgress = data.isStarting || data.isStopping || data.isRestarting;
        const status = isOperationInProgress 
          ? (data.isStopping ? 'stopping' : data.isRestarting ? 'restarting' : 'starting')
          : undefined;
        
        updateState({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          dockerRunning: data.dockerRunning,
          version: data.version,
          error: data.error,
          status,
          operationInProgress: isOperationInProgress,
          isStarting: data.isStarting || false,
          isStopping: data.isStopping || false,
          isRestarting: data.isRestarting || false
        });
      },
      [BACKEND_EVENTS.TAKSERVER_STATUS.events.STATUS_UPDATE]: (data: SocketEventData, { state, updateState }) => {
        console.log('TAK Server Status:', {
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          status: data.status,
          currentState: state
        });
        
        const isOperationInProgress = data.isStarting || data.isStopping || data.isRestarting;
        const status = isOperationInProgress 
          ? (data.isStopping ? 'stopping' : data.isRestarting ? 'restarting' : 'starting')
          : undefined;
        
        if (state.isInstalled !== data.isInstalled ||
            state.isRunning !== data.isRunning ||
            state.dockerRunning !== data.dockerRunning ||
            state.version !== data.version ||
            state.error !== data.error ||
            state.status !== status) {
          
          updateState({
            isInstalled: data.isInstalled,
            isRunning: data.isRunning,
            dockerRunning: data.dockerRunning,
            version: data.version,
            error: data.error,
            status,
            operationInProgress: isOperationInProgress,
            isStarting: data.isStarting || false,
            isStopping: data.isStopping || false,
            isRestarting: data.isRestarting || false
          });
        }
      }
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <TakServerStatus socket={takSocket} />
      {takSocket.state.isInstalled && (
        <>
          <AdvancedFeatures />
          <Configuration />
        </>
      )}
    </div>
  );
};

export default Takserver;
