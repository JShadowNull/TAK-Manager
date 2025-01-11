import React, { useEffect } from 'react';
import { Button } from '../../shared/ui/shadcn/button';
import { TakServerState } from '../types';
import { LoadingSpinner } from '../../shared/ui/icons/LoadingSpinner';
import useFetch from '../../shared/hooks/useFetch';

interface ControlButtonsProps {
  takState: TakServerState;
  onUninstall: () => void;
  onRestart: () => void;
  onStartStop: () => void;
  onInstall: () => void;
  disabled: boolean;
  currentOperation: 'start' | 'stop' | 'restart' | 'uninstall' | 'install' | null;
  setShowUninstallConfirm: (show: boolean) => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  takState,
  onRestart,
  onStartStop,
  onInstall,
  disabled,
  currentOperation,
  setShowUninstallConfirm
}) => {
  const { post } = useFetch();

  // Start API call if there's a pending operation after refresh
  useEffect(() => {
    if (currentOperation === 'start') {
      handleStart();
    } else if (currentOperation === 'stop') {
      handleStop();
    } else if (currentOperation === 'restart') {
      handleRestart();
    }
  }, []);

  const handleStart = async () => {
    try {
      onStartStop();
      await post('/api/takserver/takserver-start');
    } catch (error) {
      console.error('Failed to start TAK server:', error);
      onStartStop();
    }
  };

  const handleStop = async () => {
    try {
      onStartStop();
      await post('/api/takserver/takserver-stop');
    } catch (error) {
      console.error('Failed to stop TAK server:', error);
      onStartStop();
    }
  };

  const handleRestart = async () => {
    try {
      onRestart();
      await post('/api/takserver/takserver-restart');
    } catch (error) {
      console.error('Failed to restart TAK server:', error);
      onRestart();
    }
  };

  const handleUninstallClick = () => {
    setShowUninstallConfirm(true);
  };

  return (
    <div className="flex gap-4">
      {takState.isInstalled ? (
        <>
          {takState.isRunning ? (
            <>
              <Button
                onClick={handleStop}
                disabled={disabled}
              >
                {currentOperation === 'stop' && (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                )}
                Stop
              </Button>
              <Button
                onClick={handleRestart}
                disabled={disabled}
              >
                {currentOperation === 'restart' && <LoadingSpinner className="mr-2 h-4 w-4" />}
                Restart
              </Button>
            </>
          ) : (
            <Button
              onClick={handleStart}
              disabled={disabled}
            >
              {currentOperation === 'start' && (
                <LoadingSpinner className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          <Button
            onClick={handleUninstallClick}
            disabled={disabled}
            variant="danger"
          >
            {currentOperation === 'uninstall' && <LoadingSpinner className="mr-2 h-4 w-4" />}
            Uninstall
          </Button>
        </>
      ) : (
        <Button
          onClick={onInstall}
          disabled={disabled}
        >
          Install
        </Button>
      )}
    </div>
  );
};

export default ControlButtons; 