import React, { useState, useEffect } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import UninstallPopups from './UninstallPopups';
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

// Session storage key for WebUI readiness
const WEB_UI_READY_KEY = 'tak_web_ui_ready';

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
  const [webUIAvailable, setWebUIAvailable] = useState(() => {
    // Initialize from sessionStorage if available
    try {
      const storedValue = sessionStorage.getItem(WEB_UI_READY_KEY);
      return storedValue === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    // Only check WebUI status on mount if server is running AND we don't have a stored ready state
    if (takState.isRunning && !webUIAvailable && !isOperationInProgress) {
      // Check if we have a stored value first
      try {
        const storedValue = sessionStorage.getItem(WEB_UI_READY_KEY);
        if (storedValue === 'true') {
          setWebUIAvailable(true);
        } else if (storedValue !== 'true') {
          // Only check if we don't have a positive stored value
          checkWebUIStatus();
        }
      } catch (e) {
        // If sessionStorage fails, fall back to checking
        checkWebUIStatus();
      }
    }
    
    // Reset WebUI availability when server stops
    if (!takState.isRunning && webUIAvailable) {
      setWebUIAvailable(false);
      try {
        sessionStorage.removeItem(WEB_UI_READY_KEY);
      } catch (e) {
        console.error('Failed to update sessionStorage:', e);
      }
    }
  }, [takState.isRunning]);

  const checkWebUIStatus = async () => {
    // Don't check if another operation is in progress
    if (isOperationInProgress) return;
    
    setIsCheckingWebUI(true);
    try {
      const response = await fetch('/api/takserver/webui-status');
      
      if (!response.ok) {
        throw new Error('Failed to check TAK Server readiness');
      }
      
      const result = await response.json();
      
      if (takState.isRunning) {
        const isAvailable = result.status === 'available';
        setWebUIAvailable(isAvailable);
        
        // Store the result in sessionStorage
        try {
          if (isAvailable) {
            sessionStorage.setItem(WEB_UI_READY_KEY, 'true');
          } else {
            sessionStorage.removeItem(WEB_UI_READY_KEY);
          }
        } catch (e) {
          console.error('Failed to update sessionStorage:', e);
        }
        
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
        try {
          sessionStorage.removeItem(WEB_UI_READY_KEY);
        } catch (e) {
          console.error('Failed to update sessionStorage:', e);
        }
        
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
      
      // Only check WebUI status after start or restart operations
      if (operation === 'start' || operation === 'restart') {
        setIsOperationInProgress(false);
        setCurrentOperation(null);
        // Clear previous WebUI status and check again
        setWebUIAvailable(false);
        try {
          sessionStorage.removeItem(WEB_UI_READY_KEY);
        } catch (e) {
          console.error('Failed to update sessionStorage:', e);
        }
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
      setIsOperationInProgress(true);
      
      // Clear WebUI readiness state on uninstall
      setWebUIAvailable(false);
      try {
        sessionStorage.removeItem(WEB_UI_READY_KEY);
      } catch (e) {
        console.error('Failed to update sessionStorage:', e);
      }
      
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
    } finally {
      setIsOperationInProgress(false);
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
      <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-2 max-w-lg">
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

      <UninstallPopups
        showUninstallConfirm={showUninstallConfirm}
        onUninstallConfirmClose={() => setShowUninstallConfirm(false)}
        onUninstallConfirm={handleUninstallConfirm}
        showUninstallProgress={showUninstallProgress}
        onUninstallComplete={handleUninstallComplete}
      />
    </>
  );
};

export default ControlButtons; 