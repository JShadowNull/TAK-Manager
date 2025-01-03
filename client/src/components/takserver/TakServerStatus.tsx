import React, { useState, useEffect } from 'react';
import { TakServerState } from '../../pages/Takserver';
import { FormState, TakServerStatusProps } from './types';
import useFetch from '../shared/hooks/useFetch';
import useSocket from '../shared/hooks/useSocket';
import StatusDisplay from './components/StatusDisplay';
import ControlButtons from './components/ControlButtons';
import InstallationForm from './components/InstallationForm';
import Popups from './components/Popups';
import { useUninstall } from './hooks/useUninstall';
import { useUninstallProgress } from './hooks/useUninstallProgress';

const TakServerStatus: React.FC<TakServerStatusProps> = ({ socket }) => {
  // Track the actual server state separately from socket state during operations
  const [serverState, setServerState] = useState<TakServerState>(socket.state);

  // Operation states
  const [operationInProgress, setOperationInProgress] = useState<boolean>(false);
  const [operationError, setOperationError] = useState<string | undefined>(undefined);
  const [currentOperation, setCurrentOperation] = useState<'start' | 'stop' | 'restart' | 'uninstall' | null>(null);

  // Installation states
  const [showInstallForm, setShowInstallForm] = useState<boolean>(false);
  const [showInstallProgress, setShowInstallProgress] = useState<boolean>(false);
  const [showInstallComplete, setShowInstallComplete] = useState<boolean>(false);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installError, setInstallError] = useState<string | undefined>(undefined);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);

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

  const { post, get } = useFetch();

  // Initialize installer socket with event handlers
  const installerSocket = useSocket('/takserver-installer', {
    eventHandlers: {
      handleTerminalOutput: true,
      'terminal_output': (data: { data: string }, { appendToTerminal }) => {
        console.log('Terminal output received:', data);
        if (data.data) {
          appendToTerminal(data.data);
          setTerminalOutput(prev => [...prev, data.data]);
        }
      },
      'operation_status': (data: { status: string; progress?: number; error?: string }, { updateState }) => {
        console.log('Operation status update:', data);
        if (data.progress !== undefined) {
          setInstallProgress(data.progress);
        }
        if (data.error) {
          setInstallError(data.error);
        }
      }
    },
    initialState: {
      progress: 0,
      status: 'idle',
      error: null
    }
  });

  // Initialize uninstaller socket with event handlers
  const uninstallerSocket = useSocket('/takserver-uninstall', {
    eventHandlers: {
      handleTerminalOutput: true,
      'terminal_output': (data: { data: string }, { appendToTerminal }) => {
        console.log('Uninstall terminal output received:', data);
        if (data.data) {
          appendToTerminal(data.data);
          setUninstallTerminalOutput(prev => [...prev, data.data]);
        }
      },
      'operation_status': (data: { status: string; progress?: number; error?: string }, { updateState }) => {
        console.log('Uninstall operation status update:', data);
        if (data.progress !== undefined) {
          setUninstallProgress(data.progress);
        }
        if (data.error) {
          setUninstallError(data.error);
        }
      }
    },
    initialState: {
      progress: 0,
      status: 'idle',
      error: null
    }
  });

  // Add state for uninstall terminal output
  const [uninstallTerminalOutput, setUninstallTerminalOutput] = useState<string[]>([]);

  // Initialize uninstall hook
  const {
    showUninstallConfirm,
    showUninstallProgress,
    showUninstallComplete,
    uninstallId,
    uninstallProgress,
    uninstallError,
    setShowUninstallConfirm,
    setShowUninstallProgress,
    setShowUninstallComplete,
    setUninstallId,
    setUninstallProgress,
    setUninstallError,
    handleUninstall: originalHandleUninstall,
    handleUninstallComplete: originalHandleUninstallComplete
  } = useUninstall({
    socket,
    setOperationInProgress,
    setCurrentOperation
  });

  // Initialize uninstall progress hook
  useUninstallProgress({
    socket,
    uninstallId,
    showUninstallProgress,
    setUninstallProgress,
    setUninstallError,
    setShowUninstallProgress,
    setShowUninstallComplete,
    setUninstallId,
    setOperationInProgress,
    setCurrentOperation,
    get
  });

  // Effect to handle socket state updates
  useEffect(() => {
    if (!operationInProgress) {
      console.log('Updating server state from socket:', socket.state);
      setServerState(socket.state);
    } else {
      console.log('Ignoring socket state update during operation:', socket.state);
    }
  }, [socket.state, operationInProgress]);

  // Effect to poll operation progress
  useEffect(() => {
    let pollTimer: NodeJS.Timeout;
    
    const pollOperationProgress = async () => {
      if (operationInProgress) {
        try {
          const response = await get('/api/takserver/takserver-operation-progress');
          console.log('Operation progress response:', response);
          
          if (response.status === 'complete' || response.status === 'idle') {
            console.log(`Operation ${response.status}, resetting states`);
            setOperationInProgress(false);
            setCurrentOperation(null);
            // Update server state and request fresh state
            socket.emit('request_initial_state');
          } else if (response.status === 'error') {
            console.log('Operation error:', response.error);
            setOperationError(response.error);
            setOperationInProgress(false);
            setCurrentOperation(null);
            // Update server state and request fresh state
            socket.emit('request_initial_state');
          } else if (response.status === 'in_progress') {
            if (response.operation && response.operation !== currentOperation) {
              console.log('Operation type changed:', { from: currentOperation, to: response.operation });
              setCurrentOperation(response.operation);
            }
            // Continue polling only for in_progress state
            pollTimer = setTimeout(pollOperationProgress, 1000);
          }
        } catch (error) {
          console.error('Error polling operation progress:', error);
          setOperationError(error instanceof Error ? error.message : 'Operation failed');
          setOperationInProgress(false);
          setCurrentOperation(null);
          // Update server state and request fresh state
          socket.emit('request_initial_state');
        }
      }
    };

    if (operationInProgress) {
      console.log('Starting operation progress polling');
      pollOperationProgress();
    }

    return () => {
      if (pollTimer) {
        console.log('Cleaning up operation progress polling');
        clearTimeout(pollTimer);
      }
    };
  }, [operationInProgress, get, socket, currentOperation]);

  // Effect to poll installation progress
  useEffect(() => {
    let pollTimer: NodeJS.Timeout;
    
    const pollInstallProgress = async () => {
      if (installationId && showInstallProgress) {
        try {
          const response = await get(`/api/takserver/installation-progress/${installationId}`);
          console.log('Installation progress response:', response);
          
          setInstallProgress(response.progress);
          
          if (response.status === 'complete') {
            // Clear the timer immediately
            if (pollTimer) {
              clearTimeout(pollTimer);
            }
            // Reset all installation states
            resetInstallationStates();
            // Update operation states
            setOperationInProgress(false);
            setCurrentOperation(null);
            socket.emit('request_initial_state');
            return;
          } else if (response.status === 'error') {
            // Clear the timer immediately
            if (pollTimer) {
              clearTimeout(pollTimer);
            }
            // Update states and show error
            setInstallError(response.error);
            setShowInstallProgress(false);
            setShowInstallComplete(true);
            resetInstallationStates();
            setOperationInProgress(false);
            setCurrentOperation(null);
            socket.emit('request_initial_state');
            return;
          } else {
            // Only set up next poll if not complete/error
            pollTimer = setTimeout(pollInstallProgress, 1000);
          }
        } catch (error) {
          console.error('Error polling installation progress:', error);
          // Stop polling and show error
          setInstallError(error instanceof Error ? error.message : 'Installation failed');
          setShowInstallProgress(false);
          setShowInstallComplete(true);
          resetInstallationStates();
          setOperationInProgress(false);
          setCurrentOperation(null);
          socket.emit('request_initial_state');
        }
      }
    };

    if (installationId && showInstallProgress) {
      pollInstallProgress();
    }

    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [installationId, showInstallProgress, get, socket, setOperationInProgress, setCurrentOperation]);

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

      setShowInstallForm(false);
      setShowInstallProgress(true);
      setInstallError(undefined);
      setTerminalOutput([]); // Clear terminal output
      installerSocket.clearTerminal();
      
      const response = await post('/api/takserver/install-takserver', formDataToSend);
      
      if (response.success && response.installation_id) {
        setInstallationId(response.installation_id);
        // Request initial state after setting installation ID
        installerSocket.emit('request_initial_state', { installation_id: response.installation_id });
      } else {
        throw new Error(response.message || 'Installation failed to start');
      }

    } catch (error) {
      console.error('Installation error:', error);
      setInstallError(error instanceof Error ? error.message : 'Installation failed');
      setShowInstallProgress(false);
      setShowInstallComplete(true);
    }
  };

  const handleInstallComplete = () => {
    setShowInstallComplete(false);
    setInstallProgress(0);
    setInstallError(undefined);
    setTerminalOutput([]);
    installerSocket.clearTerminal();
    handleClose();
  };

  // Add a new function to reset all installation states
  const resetInstallationStates = () => {
    setShowInstallProgress(false);
    setShowInstallComplete(false);
    setInstallationId(null);
    setInstallProgress(0);
    setInstallError(undefined);
    setTerminalOutput([]);
    installerSocket.clearTerminal();
  };

  // Server operation handlers
  const handleStartStopClick = async () => {
    try {
      setOperationError(undefined);
      const isStarting = !serverState.isRunning;
      const operation = isStarting ? 'start' : 'stop';
      
      console.log(`Initiating ${operation} operation`);
      setCurrentOperation(operation);
      setOperationInProgress(true);
      
      await post(`/api/takserver/takserver-${operation}`);
      console.log(`${operation} request sent to backend`);

    } catch (error) {
      console.error(`Error during ${!serverState.isRunning ? 'start' : 'stop'} operation:`, error);
      setOperationError(error instanceof Error ? error.message : String(error));
      setOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(undefined);
      
      console.log('Initiating restart operation');
      setCurrentOperation('restart');
      setOperationInProgress(true);
      
      await post('/api/takserver/takserver-restart');
      console.log('Restart request sent to backend');

    } catch (error) {
      console.error('Error during restart operation:', error);
      setOperationError(error instanceof Error ? error.message : String(error));
      setOperationInProgress(false);
      setCurrentOperation(null);
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

  // Add a new function to reset all uninstallation states
  const resetUninstallationStates = () => {
    setShowUninstallProgress(false);
    setShowUninstallComplete(false);
    setUninstallId(null);
    setUninstallProgress(0);
    setUninstallError(undefined);
    setUninstallTerminalOutput([]);
    uninstallerSocket.clearTerminal();
  };

  const handleUninstall = async () => {
    try {
      setShowUninstallConfirm(false);
      setShowUninstallProgress(true);
      setUninstallError(undefined);
      setUninstallTerminalOutput([]);
      uninstallerSocket.clearTerminal();
      
      const response = await post('/api/takserver/uninstall-takserver');
      
      if (response.success && response.uninstall_id) {
        setUninstallId(response.uninstall_id);
        uninstallerSocket.emit('request_initial_state', { uninstall_id: response.uninstall_id });
      } else {
        throw new Error(response.message || 'Uninstallation failed to start');
      }

    } catch (error) {
      console.error('Uninstallation error:', error);
      setUninstallError(error instanceof Error ? error.message : 'Uninstallation failed');
      setShowUninstallProgress(false);
      setShowUninstallComplete(true);
    }
  };

  const handleUninstallComplete = () => {
    setShowUninstallComplete(false);
    resetUninstallationStates();
    setOperationInProgress(false);
    setCurrentOperation(null);
    socket.emit('request_initial_state');
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-4 xs:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">TAK Server Status</h3>
            <StatusDisplay
              takState={serverState}
              operationError={operationError}
            />
          </div>
          <ControlButtons
            takState={serverState}
            onUninstall={() => setShowUninstallConfirm(true)}
            onRestart={handleRestartClick}
            onStartStop={handleStartStopClick}
            onInstall={() => setShowInstallForm(true)}
            disabled={operationInProgress}
            currentOperation={currentOperation}
          />
        </div>
      </div>

      {!serverState.isInstalled && showInstallForm && (
        <div className="w-full border border-border bg-card p-4 xs:p-6 rounded-lg shadow-lg">
          <InstallationForm
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleInstall}
            onCancel={handleClose}
          />
        </div>
      )}

      <Popups
        // Installation props
        showInstallProgress={showInstallProgress}
        showInstallComplete={showInstallComplete}
        installProgress={installProgress}
        installError={installError}
        onInstallProgressClose={() => setShowInstallProgress(false)}
        onInstallComplete={handleInstallComplete}
        onMoveToInstallComplete={() => {
          setShowInstallProgress(false);
          setShowInstallComplete(true);
        }}
        terminalOutput={installerSocket.terminalOutput}
        
        // Uninstallation props
        showUninstallConfirm={showUninstallConfirm}
        showUninstallProgress={showUninstallProgress}
        showUninstallComplete={showUninstallComplete}
        uninstallProgress={uninstallProgress}
        uninstallError={uninstallError}
        onUninstallConfirmClose={() => setShowUninstallConfirm(false)}
        onUninstall={handleUninstall}
        onUninstallProgressClose={() => setShowUninstallProgress(false)}
        onUninstallComplete={handleUninstallComplete}
        onMoveToUninstallComplete={() => {
          setShowUninstallProgress(false);
          setShowUninstallComplete(true);
        }}
        uninstallTerminalOutput={uninstallerSocket.terminalOutput}
      />
    </>
  );
};

export default TakServerStatus; 