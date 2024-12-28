import React, { useState, useEffect } from 'react';
import { TakServerState } from '../../pages/Takserver';
import { FormState } from './types';
import useFetch from '../shared/hooks/useFetch';
import { useInstallSocket } from './hooks/useInstallSocket';
import { useUninstallSocket } from './hooks/useUninstallSocket';
import StatusDisplay from './components/StatusDisplay';
import ControlButtons from './components/ControlButtons';
import InstallationForm from './components/InstallationForm';
import Popups from './components/Popups';

interface TakServerStatusProps {
  socket: {
    state: TakServerState;
    updateState: (state: Partial<TakServerState>) => void;
    emit: (event: string, data?: any) => void;
    error: Error | null;
  };
}

const TakServerStatus: React.FC<TakServerStatusProps> = ({ socket }) => {
  // Installation states
  const [showInstallForm, setShowInstallForm] = useState<boolean>(false);
  const [showInstallProgress, setShowInstallProgress] = useState<boolean>(false);
  const [showInstallComplete, setShowInstallComplete] = useState<boolean>(false);

  // Uninstallation states
  const [showUninstallConfirm, setShowUninstallConfirm] = useState<boolean>(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState<boolean>(false);
  const [showUninstallComplete, setShowUninstallComplete] = useState<boolean>(false);

  const [operationError, setOperationError] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<FormState>({
    docker_zip_file: null,
    postgres_password: '',
    certificate_password: '',
    organization: '',
    state: '',
    city: '',
    organizational_unit: '',
    name: '',
    installation_id: null
  });

  // Hooks
  const { post, clearError } = useFetch();
  const installSocket = useInstallSocket();
  const uninstallSocket = useUninstallSocket();
  const takState = socket.state;
  const updateTakState = socket.updateState;

  // Effect to handle socket errors
  useEffect(() => {
    if (socket.error) {
      setOperationError(socket.error.message);
    } else {
      setOperationError(undefined);
    }
  }, [socket.error]);

  // Effect to clear fetch errors
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Installation handlers
  const handleInstall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!formData.docker_zip_file || !formData.docker_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid TAK Server ZIP file');
      }

      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null) {
          formDataToSend.append(key, value);
        }
      });

      const response = await post('/api/takserver/install-takserver', formDataToSend, {
        validateResponse: (data: { installation_id?: string }) => ({
          isValid: !!data?.installation_id,
          error: !data?.installation_id ? 'No installation ID received from server' : undefined
        })
      });

      setFormData(prev => ({
        ...prev,
        installation_id: response.installation_id
      }));

      console.log('[Debug] Starting installation');
      setShowInstallForm(false);
      setShowInstallProgress(true);
      installSocket.updateState({
        ...installSocket.state,
        isInstalling: true,
        installationComplete: false,
        installationSuccess: false,
        installationError: undefined
      });
      installSocket.emit('start_installation', { installation_id: response.installation_id });

    } catch (error) {
      console.error('[Debug] Installation error:', error);
      installSocket.updateState({
        isInstalling: false,
        installationError: error instanceof Error ? error.message : 'Installation failed'
      });
    }
  };

  const handleInstallComplete = () => {
    console.log('[Debug] handleInstallComplete called', {
      state: installSocket.state
    });
    
    if (installSocket.state.installationComplete) {
      setShowInstallProgress(false);
      setShowInstallComplete(true);
      
      // Update installation state to reflect rollback status
      const isRollback = installSocket.state.isStoppingInstallation || 
                        installSocket.state.installationError?.toLowerCase().includes('rolled back');
      
      if (isRollback) {
        console.log('[Debug] Installation was rolled back, updating state');
        installSocket.updateState({
          ...installSocket.state,
          installationSuccess: false,
          installationError: 'Installation was cancelled and rolled back',
          isStoppingInstallation: false,
          isInstalling: false
        });
      }
      
      console.log('[Debug] Installation complete popup shown', {
        isSuccess: installSocket.state.installationSuccess,
        isStopping: installSocket.state.isStoppingInstallation,
        error: installSocket.state.installationError
      });
    }
  };

  const handleInstallClose = () => {
    console.log('[Debug] handleInstallClose called');
    setShowInstallComplete(false);
    handleClose();
    // Reset installation state
    installSocket.updateState({
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      installationError: undefined
    });
  };

  // Uninstallation handlers
  const handleUninstall = () => {
    console.log('[Debug] Starting uninstallation');
    setShowUninstallConfirm(false);
    setShowUninstallProgress(true);
    uninstallSocket.updateState({
      ...uninstallSocket.state,
      uninstallComplete: false,
      uninstallSuccess: false,
      uninstallError: undefined
    });
    uninstallSocket.emit('start_uninstall');
  };

  const handleUninstallComplete = () => {
    console.log('[Debug] handleUninstallComplete called');
    setShowUninstallProgress(false);
    setShowUninstallComplete(true);
  };

  const handleUninstallClose = () => {
    console.log('[Debug] handleUninstallClose called');
    setShowUninstallComplete(false);
    if (uninstallSocket.state.uninstallComplete) {
      uninstallSocket.updateState({
        uninstallComplete: false,
        uninstallSuccess: false,
        uninstallError: undefined
      });
    }
  };

  // Other handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, files, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'file' ? files?.[0] || null : value
    }));
  };

  const handleClose = () => {
    setShowInstallForm(false);
    setFormData({
      docker_zip_file: null,
      postgres_password: '',
      certificate_password: '',
      organization: '',
      state: '',
      city: '',
      organizational_unit: '',
      name: '',
      installation_id: null
    });
  };

  const handleCancelInstallation = async () => {
    console.log('[Debug] Cancelling installation');
    if (installSocket.state.isInstalling) {
      try {
        installSocket.updateState({
          ...installSocket.state,
          isStoppingInstallation: true,
          installationSuccess: false,
          installationError: 'Installation cancelled by user'
        });
        
        // Call the rollback endpoint with the installation ID
        await post('/api/takserver/rollback-takserver', {
          installation_id: formData.installation_id
        });
        
        console.log('[Debug] Rollback initiated');
        // Socket will handle the status updates
        installSocket.emit('stop_install');
      } catch (error) {
        console.error('[Debug] Error during installation rollback:', error);
        installSocket.updateState({
          ...installSocket.state,
          isStoppingInstallation: false,
          installationSuccess: false,
          installationError: error instanceof Error ? error.message : 'Rollback failed',
          isInstalling: false
        });
      }
    }
  };

  const handleStartStopClick = async () => {
    try {
      setOperationError(undefined);
      const isStarting = !takState.isRunning;
      
      updateTakState({
        ...takState,
        isStarting: isStarting,
        isStopping: !isStarting,
        error: undefined
      });
      
      await post(`/api/takserver/takserver-${isStarting ? 'start' : 'stop'}`);
      
      // After operation completes, request updated status
      socket.emit('check_status');
    } catch (error) {
      console.error('Error starting/stopping TAK server:', error);
      setOperationError(error instanceof Error ? error.message : String(error));
      
      // Reset state on error
      updateTakState({
        ...takState,
        isStarting: false,
        isStopping: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(undefined);
      
      updateTakState({
        ...takState,
        isRestarting: true,
        error: undefined
      });
      
      await post('/api/takserver/takserver-restart');
      
      // After operation completes, request updated status
      socket.emit('check_status');
    } catch (error) {
      console.error('Error restarting TAK server:', error);
      setOperationError(error instanceof Error ? error.message : String(error));
      
      // Reset restart state on error
      updateTakState({
        ...takState,
        isRestarting: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg shadow-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">TAK Server Status</h3>
            <StatusDisplay
              takState={takState}
              operationError={operationError}
            />
          </div>
          <ControlButtons
            takState={takState}
            onUninstall={() => setShowUninstallConfirm(true)}
            onRestart={handleRestartClick}
            onStartStop={handleStartStopClick}
            onInstall={() => setShowInstallForm(true)}
          />
        </div>
      </div>

      {!takState.isInstalled && showInstallForm && (
        <InstallationForm
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleInstall}
          onCancel={handleClose}
        />
      )}

      <Popups
        // Installation props
        showInstallProgress={showInstallProgress}
        showInstallComplete={showInstallComplete}
        installState={installSocket.state}
        onInstallProgressClose={() => {
          if (installSocket.state.isInstalling && !installSocket.state.isStoppingInstallation) {
            return;
          }
          setShowInstallProgress(false);
        }}
        onInstallComplete={handleInstallClose}
        onInstallNext={handleInstallComplete}
        onCancelInstallation={handleCancelInstallation}
        
        // Uninstallation props
        showUninstallConfirm={showUninstallConfirm}
        showUninstallProgress={showUninstallProgress}
        showUninstallComplete={showUninstallComplete}
        uninstallState={uninstallSocket.state}
        onUninstallConfirmClose={() => setShowUninstallConfirm(false)}
        onUninstall={handleUninstall}
        onUninstallProgressClose={() => setShowUninstallProgress(false)}
        onUninstallNext={handleUninstallComplete}
        onUninstallComplete={handleUninstallClose}
      />
    </>
  );
};

export default TakServerStatus; 