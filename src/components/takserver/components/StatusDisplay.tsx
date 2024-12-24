import React from 'react';
import { TakServerState } from '../../../pages/Takserver';

interface StatusDisplayProps {
  takState: TakServerState;
  operationError?: string;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ takState, operationError }) => {
  return (
    <div className="flex flex-col gap-3 mb-4">
      {takState.isInstalled ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">Status:</span>
            <div className="flex items-center gap-2">
              {takState.isStarting || takState.isStopping || takState.isRestarting ? (
                <span className={`text-sm ${
                  takState.isStarting ? "text-green-500" :
                  takState.isRestarting ? "text-yellow-500" :
                  "text-red-500"
                } font-semibold`}>
                  {takState.isStarting ? "Starting..." :
                   takState.isRestarting ? "Restarting..." :
                   "Stopping..."}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {takState.isRunning ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm text-green-500 font-semibold">Running</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span className="text-sm text-red-500 font-semibold">Stopped</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {takState.version && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">Version:</span>
              <span className="text-sm text-primary">{takState.version}</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">Installation:</span>
          <span className="text-sm text-red-500 font-semibold">
            Not Installed
          </span>
        </div>
      )}
      {operationError && (
        <div className="text-sm text-red-500 font-medium mt-2">
          Error: {operationError}
        </div>
      )}
    </div>
  );
};

export default StatusDisplay; 