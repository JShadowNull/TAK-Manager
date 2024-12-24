import React, { useEffect } from 'react';
import { Button } from '../../shared/ui/shadcn/button';
import LoadingButton from '../../shared/ui/inputs/LoadingButton';
import { TakServerState } from '../../../pages/Takserver';

interface ControlButtonsProps {
  takState: TakServerState;
  onUninstall: () => void;
  onRestart: () => void;
  onStartStop: () => void;
  onInstall: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  takState,
  onUninstall,
  onRestart,
  onStartStop,
  onInstall
}) => {
  // Debug TAK state changes
  useEffect(() => {
    console.log('TAK State Updated:', {
      isInstalled: takState.isInstalled,
      isRunning: takState.isRunning,
      isStarting: takState.isStarting,
      isStopping: takState.isStopping,
      isRestarting: takState.isRestarting
    });
  }, [takState]);

  // Wrapped handlers with debug logs
  const handleUninstall = () => {
    console.log('Uninstall button clicked');
    onUninstall();
  };

  const handleRestart = () => {
    console.log('Restart button clicked');
    onRestart();
  };

  const handleStartStop = () => {
    console.log(`${takState.isRunning ? 'Stop' : 'Start'} button clicked`);
    onStartStop();
  };

  const handleInstall = () => {
    console.log('Install button clicked');
    onInstall();
  };

  return (
    <div className="flex justify-start gap-4">
      {takState.isInstalled ? (
        <>
          <Button
            onClick={handleUninstall}
            disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
            variant="danger"
          >
            Uninstall
          </Button>
          {takState.isRunning && (
            <>
              <LoadingButton
                onClick={handleRestart}
                disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                isLoading={takState.isRestarting}
                operation="restart"
                variant="primary"
                className="hover:bg-yellow-500 transition-colors"
              >
                Restart
              </LoadingButton>
              <LoadingButton
                onClick={handleStartStop}
                disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                isLoading={takState.isStopping}
                operation="stop"
                variant="primary"
                className="hover:bg-red-500 transition-colors"
              >
                Stop
              </LoadingButton>
            </>
          )}
          {!takState.isRunning && (
            <LoadingButton
              onClick={handleStartStop}
              disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
              isLoading={takState.isStarting}
              operation="start"
              variant="primary"
              className="hover:bg-green-500 transition-colors"
            >
              Start
            </LoadingButton>
          )}
        </>
      ) : (
        <Button
          onClick={handleInstall}
          variant="primary"
          className="hover:bg-green-500 transition-colors"
        >
          Install TAK Server
        </Button>
      )}
    </div>
  );
};

export default ControlButtons; 