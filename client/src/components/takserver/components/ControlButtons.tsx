import React, { useState } from 'react';
import { Button } from '../../shared/ui/shadcn/button';
import { LoadingSpinner } from '../../shared/ui/icons/LoadingSpinner';
import Popups from './Popups';

interface TakServerState {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  error?: string | null;
}

type Operation = 'start' | 'stop' | 'restart' | 'install' | 'uninstall' | null;

interface ControlButtonsProps {
  takState: TakServerState;
  onInstall: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  takState,
  onInstall
}) => {
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);

  const handleOperation = async (operation: Operation, endpoint: string) => {
    try {
      setIsLoading(true);
      setCurrentOperation(operation);
      setError(null);

      const response = await fetch(`/api/takserver/takserver-${endpoint}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Operation failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to ${operation} TAK server:`, error);
      setError(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setIsLoading(false);
      setCurrentOperation(null);
    }
  };

  const handleStart = () => handleOperation('start', 'start');
  const handleStop = () => handleOperation('stop', 'stop');
  const handleRestart = () => handleOperation('restart', 'restart');
  
  const handleUninstallClick = () => setShowUninstallConfirm(true);
  
  const handleUninstallConfirm = () => {
    setShowUninstallConfirm(false);
    setShowUninstallProgress(true);
  };

  const handleUninstallComplete = () => {
    setShowUninstallProgress(false);
  };

  return (
    <>
      <div className="flex gap-4">
        {error && (
          <p className="text-sm text-destructive mb-2">{error}</p>
        )}
        
        {takState.isInstalled ? (
          <>
            {takState.isRunning ? (
              <>
                <Button
                  onClick={handleStop}
                  disabled={isLoading}
                >
                  {currentOperation === 'stop' && (
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                  )}
                  Stop
                </Button>
                <Button
                  onClick={handleRestart}
                  disabled={isLoading}
                >
                  {currentOperation === 'restart' && <LoadingSpinner className="mr-2 h-4 w-4" />}
                  Restart
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStart}
                disabled={isLoading}
              >
                {currentOperation === 'start' && (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                )}
                Start
              </Button>
            )}
            <Button
              onClick={handleUninstallClick}
              disabled={isLoading}
              variant="danger"
            >
              {currentOperation === 'uninstall' && <LoadingSpinner className="mr-2 h-4 w-4" />}
              Uninstall
            </Button>
          </>
        ) : (
          <Button
            onClick={onInstall}
            disabled={isLoading}
          >
            {currentOperation === 'install' && <LoadingSpinner className="mr-2 h-4 w-4" />}
            Install
          </Button>
        )}
      </div>

      <Popups
        showUninstallConfirm={showUninstallConfirm}
        onUninstallConfirmClose={() => setShowUninstallConfirm(false)}
        onUninstallConfirm={handleUninstallConfirm}
        onInstallComplete={() => {}}
        onUninstallComplete={handleUninstallComplete}
        showUninstallProgress={showUninstallProgress}
      />
    </>
  );
};

export default ControlButtons; 