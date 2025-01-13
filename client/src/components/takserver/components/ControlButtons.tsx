import React, { useState, useEffect } from 'react';
import { Button } from '../../shared/ui/shadcn/button';
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
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);

  useEffect(() => {
    console.debug('[ControlButtons] Operation status stream - Starting EventSource connection');
    const eventSource = new EventSource('/api/takserver/operation-status-stream');

    eventSource.addEventListener('operation-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.debug('[ControlButtons] Operation status event received:', data);
        
        // Handle operation status events
        if (data.status === 'complete' || data.status === 'error') {
          console.debug('[ControlButtons] Operation completed/errored, resetting states');
          setIsLoading(false);
          setIsOperationInProgress(false);
          setCurrentOperation(null);
          if (data.error) {
            setError(data.error);
          } else {
            setError(null);
          }
        }
      } catch (error) {
        console.error('[ControlButtons] Error processing operation status:', error);
        setIsLoading(false);
        setIsOperationInProgress(false);
        setCurrentOperation(null);
      }
    });

    return () => {
      console.debug('[ControlButtons] Operation status stream - Closing EventSource connection');
      eventSource.close();
    };
  }, []); // Empty dependency array to prevent reconnection

  // Add effect to monitor state changes
  useEffect(() => {
    console.log('Operation state changed:', {
      currentOperation,
      isLoading,
      isOperationInProgress,
      error
    });
  }, [currentOperation, isLoading, isOperationInProgress, error]);

  const handleOperation = async (operation: Operation, endpoint: string) => {
    try {
      console.log('Starting operation:', operation);
      setError(null);
      setCurrentOperation(operation);
      setIsLoading(true);
      setIsOperationInProgress(true);
      console.log('Set initial operation states:', { operation, isLoading: true, isOperationInProgress: true });
      
      const response = await fetch(`/api/takserver/${endpoint}-takserver`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Operation failed: ${response.statusText}`);
      }
      console.log('Operation request successful');
    } catch (error) {
      console.error('Operation request failed:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsLoading(false);
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      console.log('Reset states due to error');
    }
  };

  const handleStart = () => handleOperation('start', 'start');
  const handleStop = () => handleOperation('stop', 'stop');
  const handleRestart = () => handleOperation('restart', 'restart');
  
  const handleUninstallClick = () => setShowUninstallConfirm(true);
  
  const handleUninstallConfirm = () => {
    setShowUninstallConfirm(false);
    setShowUninstallProgress(true);
    handleOperation('uninstall', 'uninstall');
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
                  disabled={isOperationInProgress}
                  loading={currentOperation === 'stop'}
                  loadingText="Stopping"
                >
                  Stop
                </Button>
                <Button
                  onClick={handleRestart}
                  disabled={isOperationInProgress}
                  loading={currentOperation === 'restart'}
                  loadingText="Restarting"
                >
                  Restart
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStart}
                disabled={isOperationInProgress}
                loading={currentOperation === 'start'}
                loadingText="Starting"
              >
                Start
              </Button>
            )}
            <Button
              onClick={handleUninstallClick}
              disabled={isOperationInProgress}
              loading={currentOperation === 'uninstall'}
              loadingText="Uninstalling"
              variant="danger"
            >
              Uninstall
            </Button>
          </>
        ) : (
          <Button
            onClick={onInstall}
            disabled={isOperationInProgress}
            loading={currentOperation === 'install'}
            loadingText="Installing"
          >
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