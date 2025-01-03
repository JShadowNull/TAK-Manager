import React from 'react';
import TakServerStatus from '../components/takserver/TakServerStatus';
import AdvancedFeatures from '../components/takserver/AdvancedFeatures';
import Configuration from '../components/takserver/Configuration';
import useSocket, { BACKEND_EVENTS } from '../components/shared/hooks/useSocket';
import { TakServerStatusEvent } from '../components/takserver/types';

export interface TakServerState {
  isInstalled: boolean;
  isRunning: boolean;
  error: string | null;
  status: string | undefined;
}

const Takserver: React.FC = () => {
  const takSocket = useSocket(BACKEND_EVENTS.TAKSERVER_STATUS.namespace, {
    initialState: {
      isInstalled: false,
      isRunning: false,
      error: null,
      status: undefined
    },
    eventHandlers: {
      'operation_status': (data: TakServerStatusEvent, { updateState }) => {
        console.log('Received TAK Server operation status:', data);
        updateState({
          isInstalled: data.status !== 'not_installed',
          isRunning: data.status === 'running',
          error: data.error || null,
          status: data.status
        });
      }
    }
  });

  return (
    <div className="space-y-4 w-full">
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
