import React, { useState, useEffect } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import Popups from './TakOperationPopups';
import { useToast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { useTakServer } from '../../../shared/ui/shadcn/sidebar/app-sidebar';

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
  const { toast } = useToast();
  const { refreshServerStatus } = useTakServer();
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);
  const [isCheckingWebUI, setIsCheckingWebUI] = useState(false);
  const [webUIAvailable, setWebUIAvailable] = useState(false);

  useEffect(() => {
    if (takState.isRunning && !webUIAvailable) {
      checkWebUIStatus();
    }
  }, [takState.isRunning]);

  const checkWebUIStatus = async () => {
    setIsCheckingWebUI(true);
    try {
      const response = await fetch('/api/takserver/webui-status');
      
      if (!response.ok) {
        throw new Error('Failed to check TAK Server readiness');
      }
      
      const result = await response.json();
      
      if (takState.isRunning) {
        setWebUIAvailable(result.status === 'available');
        
        if (result.status === 'initializing') {
          toast({
            title: "TAK Server Initializing",
            description: "The server is still starting up. Please wait...",
            variant: "default"
          });
        } else if (result.status !== 'available') {
          toast({
            title: "TAK Server Not Ready",
            description: result.error || 'The server is not fully initialized',
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      if (takState.isRunning) {
        setWebUIAvailable(false);
        const errorMessage = error instanceof Error ? error.message : 'Failed to check TAK Server readiness';
        toast({
          title: "Readiness Check Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsCheckingWebUI(false);
    }
  };

  const handleOperation = async (operation: Operation, endpoint: string) => {
    try {
      setCurrentOperation(operation);
      setIsOperationInProgress(true);
      
      const response = await fetch(`/api/takserver/${endpoint}-takserver`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Operation failed: ${response.statusText}`);
      }

      await refreshServerStatus();

      toast({
        title: "Operation Successful",
        description: `${operation?.charAt(0)?.toUpperCase() ?? ''}${operation?.slice(1) ?? ''} completed successfully!`,
        variant: "success"
      });
      
      if (operation === 'start' || operation === 'restart') {
        setIsOperationInProgress(false);
        setCurrentOperation(null);
        await checkWebUIStatus();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      
      await refreshServerStatus();

      toast({
        title: "Operation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleStart = () => handleOperation('start', 'start');
  const handleStop = () => handleOperation('stop', 'stop');
  const handleRestart = () => handleOperation('restart', 'restart');
  
  const handleUninstallClick = () => {
    setShowUninstallConfirm(true);
  };
  
  const handleUninstallConfirm = async () => {
    try {
      // Clear any previous errors and show progress popup before making API call
      setShowUninstallConfirm(false);
      setShowUninstallProgress(true);
      
      const response = await fetch('/api/takserver/uninstall-takserver', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Uninstallation failed: ${response.statusText}`);
      }

      await refreshServerStatus();
    } catch (error) {
      console.error('Uninstallation error:', error);
      // Error handling will be shown in the progress dialog
    }
  };

  const handleUninstallComplete = () => {
    setShowUninstallProgress(false);
    onInstall(); // Reset to install view
  };

  const getWebUIButtonText = () => {
    if (isCheckingWebUI) return "Checking Server Readiness...";
    if (webUIAvailable) return "Launch TAK Web UI";
    return "Check Server Readiness";
  };

  return (
    <>
      <div className="flex flex-col min-[545px]:flex-row gap-4">
        
        {takState.isInstalled ? (
          <>
            {takState.isRunning ? (
              <>
                <Button
                  onClick={handleStop}
                  disabled={isOperationInProgress}
                  loading={currentOperation === 'stop'}
                  loadingText="Stopping"
                  className="w-full"
                >
                  Stop
                </Button>
                <Button
                  onClick={handleRestart}
                  disabled={isOperationInProgress}
                  loading={currentOperation === 'restart'}
                  loadingText="Restarting"
                  className="w-full"
                >
                  Restart
                </Button>
                <Button
                  variant="primary"
                  href={webUIAvailable ? "https://127.0.0.1:8443" : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={isOperationInProgress || isCheckingWebUI}
                  loading={isCheckingWebUI}
                  loadingText="Checking Server Readiness..."
                  onClick={!webUIAvailable ? checkWebUIStatus : undefined}
                  className="w-full whitespace-nowrap text-ellipsis"
                >
                  {getWebUIButtonText()}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStart}
                disabled={isOperationInProgress}
                loading={currentOperation === 'start'}
                loadingText="Starting"
                className="w-full"
              >
                Start
              </Button>
            )}
            <Button
              onClick={handleUninstallClick}
              disabled={isOperationInProgress}
              variant="danger"
              className="w-full"
            >
              Uninstall
            </Button>
          </>
        ) : (
          <Button
            onClick={onInstall}
            disabled={isOperationInProgress}
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