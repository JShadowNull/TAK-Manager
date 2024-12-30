import React from 'react';
import { Button } from '../../shared/ui/shadcn/button';
import LoadingButton from '../../shared/ui/inputs/LoadingButton';
import { TakServerState } from '../../../pages/Takserver';

interface ControlButtonsProps {
  takState: TakServerState;
  onUninstall: () => void;
  onRestart: () => void;
  onStartStop: () => void;
  onInstall: () => void;
  disabled: boolean;
  currentOperation: 'start' | 'stop' | 'restart' | 'uninstall' | null;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  takState,
  onUninstall,
  onRestart,
  onStartStop,
  onInstall,
  disabled,
  currentOperation
}) => {
  return (
    <div className="flex justify-start gap-4">
      {takState.isInstalled ? (
        <>
          <Button
            onClick={onUninstall}
            disabled={disabled}
            variant="danger"
          >
            Uninstall
          </Button>
          {takState.isRunning && (
            <>
              <LoadingButton
                onClick={onRestart}
                disabled={disabled}
                isLoading={currentOperation === 'restart'}
                operation="restart"
                variant="primary"
                className="hover:bg-yellow-500 transition-colors"
              >
                Restart
              </LoadingButton>
              <LoadingButton
                onClick={onStartStop}
                disabled={disabled}
                isLoading={currentOperation === 'stop'}
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
              onClick={onStartStop}
              disabled={disabled}
              isLoading={currentOperation === 'start'}
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
          onClick={onInstall}
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