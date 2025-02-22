import React from 'react';

interface TakServerState {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  error?: string | null;
}

interface StatusDisplayProps {
  takState: TakServerState;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ takState}) => (
  <div className="mb-4">
    <div className="flex flex-col gap-1">
      <p className="text-sm flex items-center gap-2">
        Status: 
        <span className="flex items-center gap-2">
          {takState.isInstalled && (
            <span className="relative flex h-2 w-2">
              {takState.isRunning ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              )}
            </span>
          )}
          <span className={takState.isInstalled ? (takState.isRunning ? "text-green-500" : "text-red-500") : "text-muted-foreground"}>
            {takState.isInstalled ? (takState.isRunning ? 'Running' : 'Stopped') : 'Not Installed'}
          </span>
        </span>
      </p>
      {takState.isInstalled && takState.version && (
        <p className="text-sm text-primary">
          Version: {takState.version}
        </p>
      )}
    </div>
  </div>
);

export default StatusDisplay; 