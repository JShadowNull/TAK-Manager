import React, { useState, useEffect } from 'react';
import { TakServerState, FormState } from './types/index';
import useFetch from '../../components/shared/hooks/useFetch';
import StatusDisplay from './components/StatusDisplay';
import ControlButtons from './components/ControlButtons';
import InstallationForm from './components/InstallationForm';
import Popups from './components/Popups';

interface TerminalLine {
  message: string;
  isError: boolean;
  timestamp: number | null;
}

interface StoredOperationState {
  operationInProgress: boolean;
  currentOperation: 'start' | 'stop' | 'restart' | 'uninstall' | 'install' | null;
  showInstallProgress: boolean;
  showInstallComplete: boolean;
  installProgress: number;
  installError?: string;
  terminalOutput: TerminalLine[];
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallProgress: number;
  uninstallError?: string;
  uninstallTerminalOutput: TerminalLine[];
}

interface TakServerStatusProps {
  initialState: TakServerState;
}

const TakServerStatus: React.FC<TakServerStatusProps> = ({ initialState }) => {
  // Track the actual server state
  const [serverState, setServerState] = useState<TakServerState>({
    ...initialState,
    version: initialState.version || undefined // Convert null to undefined to match type
  });
  const { get } = useFetch();

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('takServerState', JSON.stringify(serverState));
    // Dispatch custom event for other components
    window.dispatchEvent(new Event('takServerStateChange'));
  }, [serverState]);

  // Operation states
  const [operationInProgress, setOperationInProgress] = useState<boolean>(false);
  const [operationError, setOperationError] = useState<string | undefined>(undefined);
  const [currentOperation, setCurrentOperation] = useState<'start' | 'stop' | 'restart' | 'uninstall' | 'install' | null>(null);

  // Installation states
  const [showInstallForm, setShowInstallForm] = useState<boolean>(false);
  const [showInstallProgress, setShowInstallProgress] = useState<boolean>(false);
  const [showInstallComplete, setShowInstallComplete] = useState<boolean>(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installError, setInstallError] = useState<string | undefined>(undefined);
  const [terminalOutput, setTerminalOutput] = useState<TerminalLine[]>([]);

  // Uninstallation states
  const [showUninstallConfirm, setShowUninstallConfirm] = useState<boolean>(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState<boolean>(false);
  const [showUninstallComplete, setShowUninstallComplete] = useState<boolean>(false);
  const [uninstallProgress, setUninstallProgress] = useState<number>(0);
  const [uninstallError, setUninstallError] = useState<string | undefined>(undefined);
  const [uninstallTerminalOutput, setUninstallTerminalOutput] = useState<TerminalLine[]>([]);

  // Restore operation state from localStorage on mount
  useEffect(() => {
    const storedState = localStorage.getItem('takServerOperationState');
    if (storedState) {
      try {
        const parsedState: StoredOperationState = JSON.parse(storedState);
        setOperationInProgress(parsedState.operationInProgress);
        setCurrentOperation(parsedState.currentOperation);
        setShowInstallProgress(parsedState.showInstallProgress);
        setShowInstallComplete(parsedState.showInstallComplete);
        setInstallProgress(parsedState.installProgress);
        setInstallError(parsedState.installError);
        setTerminalOutput(parsedState.terminalOutput);
        setShowUninstallProgress(parsedState.showUninstallProgress);
        setShowUninstallComplete(parsedState.showUninstallComplete);
        setUninstallProgress(parsedState.uninstallProgress);
        setUninstallError(parsedState.uninstallError);
        setUninstallTerminalOutput(parsedState.uninstallTerminalOutput);
      } catch (error) {
        console.error('Error restoring operation state:', error);
      }
    }
  }, []);

  // Save operation state to localStorage whenever it changes
  useEffect(() => {
    const stateToStore: StoredOperationState = {
      operationInProgress,
      currentOperation,
      showInstallProgress,
      showInstallComplete,
      installProgress,
      installError,
      terminalOutput,
      showUninstallProgress,
      showUninstallComplete,
      uninstallProgress,
      uninstallError,
      uninstallTerminalOutput
    };
    localStorage.setItem('takServerOperationState', JSON.stringify(stateToStore));
  }, [
    operationInProgress,
    currentOperation,
    showInstallProgress,
    showInstallComplete,
    installProgress,
    installError,
    terminalOutput,
    showUninstallProgress,
    showUninstallComplete,
    uninstallProgress,
    uninstallError,
    uninstallTerminalOutput
  ]);

  // Clear all states when operations complete
  const clearAllStates = () => {
    // Clear operation states
    localStorage.removeItem('takServerOperationState');
    localStorage.removeItem('takServerButtonState');
    localStorage.removeItem('takServerPopupState');
    
    // Clear button states
    setOperationInProgress(false);
    setCurrentOperation(null);
    
    // Clear install states
    setShowInstallProgress(false);
    setShowInstallComplete(false);
    setInstallProgress(0);
    setInstallError(undefined);
    setTerminalOutput([]);
    
    // Clear uninstall states
    setShowUninstallProgress(false);
    setShowUninstallComplete(false);
    setUninstallProgress(0);
    setUninstallError(undefined);
    setUninstallTerminalOutput([]);
  };

  // Save popup states whenever they change
  useEffect(() => {
    const popupState = {
      showInstallProgress,
      showInstallComplete,
      installProgress,
      installError,
      terminalOutput,
      showUninstallProgress,
      showUninstallComplete,
      uninstallProgress,
      uninstallError,
      uninstallTerminalOutput
    };
    localStorage.setItem('takServerPopupState', JSON.stringify(popupState));
  }, [
    showInstallProgress,
    showInstallComplete,
    installProgress,
    installError,
    terminalOutput,
    showUninstallProgress,
    showUninstallComplete,
    uninstallProgress,
    uninstallError,
    uninstallTerminalOutput
  ]);

  // Restore popup states on mount
  useEffect(() => {
    const storedPopupState = localStorage.getItem('takServerPopupState');
    if (storedPopupState) {
      try {
        const parsedState = JSON.parse(storedPopupState);
        setShowInstallProgress(parsedState.showInstallProgress);
        setShowInstallComplete(parsedState.showInstallComplete);
        setInstallProgress(parsedState.installProgress);
        setInstallError(parsedState.installError);
        setTerminalOutput(parsedState.terminalOutput);
        setShowUninstallProgress(parsedState.showUninstallProgress);
        setShowUninstallComplete(parsedState.showUninstallComplete);
        setUninstallProgress(parsedState.uninstallProgress);
        setUninstallError(parsedState.uninstallError);
        setUninstallTerminalOutput(parsedState.uninstallTerminalOutput);
      } catch (error) {
        console.error('Error restoring popup state:', error);
      }
    }
  }, []);

  // Form data state
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

  // Function to fetch status
  const fetchStatus = async () => {
    try {
      const response = await get('/api/takserver/takserver-status');
      if (response.ok) {
        const data = await response.json();
        setServerState((prevState: TakServerState) => ({
          ...prevState,
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          version: data.version || undefined,
          status: data.status,
          error: data.error || null
        }));
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  // Initial status fetch and setup polling
  useEffect(() => {
    // Fetch initial status
    fetchStatus();

    // Set up polling every 20 seconds
    const intervalId = setInterval(fetchStatus, 20000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, files, type } = e.target;
    setFormData((prev: FormState) => ({
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

  const handleStartStopClick = () => {
    const operation = serverState.isRunning ? 'stop' : 'start';
    setOperationInProgress(true);
    setCurrentOperation(operation);
    const stateToStore = {
      operationInProgress: true,
      currentOperation: operation
    };
    localStorage.setItem('takServerButtonState', JSON.stringify(stateToStore));
  };

  const handleRestartClick = () => {
    setOperationInProgress(true);
    setCurrentOperation('restart');
    const stateToStore = {
      operationInProgress: true,
      currentOperation: 'restart'
    };
    localStorage.setItem('takServerButtonState', JSON.stringify(stateToStore));
  };

  const handleUninstall = async () => {
    try {
      setShowUninstallConfirm(false);
      setShowUninstallProgress(true);
      setUninstallProgress(0);
      setUninstallTerminalOutput([]);
      setOperationInProgress(true);
      setCurrentOperation('uninstall');

      const response = await fetch('/api/takserver/uninstall-takserver', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Uninstallation failed: ${response.statusText}`);
      }

    } catch (error) {
      console.error('Uninstallation error:', error);
      setUninstallError(error instanceof Error ? error.message : 'Uninstallation failed');
      // Don't automatically show completion dialog on error
      setOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleUninstallComplete = () => {
    clearAllStates();
    // Get actual server state
    fetchStatus();
  };

  const handleInstall = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      // Show installation progress dialog
      setShowInstallProgress(true);
      setInstallProgress(0);
      setTerminalOutput([]);
      setOperationInProgress(true);
      setCurrentOperation('install');
      
      // Create form data
      const formDataToSend = new FormData();
      if (formData.docker_zip_file) {
        formDataToSend.append('docker_zip_file', formData.docker_zip_file);
      }
      formDataToSend.append('postgres_password', formData.postgres_password);
      formDataToSend.append('certificate_password', formData.certificate_password);
      formDataToSend.append('organization', formData.organization);
      formDataToSend.append('state', formData.state);
      formDataToSend.append('city', formData.city);
      formDataToSend.append('organizational_unit', formData.organizational_unit);
      formDataToSend.append('name', formData.name);

      // Start installation
      const response = await fetch('/api/takserver/install-takserver', {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error(`Installation failed: ${response.statusText}`);
      }

      // Close install form
      setShowInstallForm(false);
      
      // Reset form data
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

    } catch (error) {
      console.error('Installation error:', error);
      setInstallError(error instanceof Error ? error.message : 'Installation failed');
      // Don't automatically show completion dialog on error
      setOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleMoveToInstallComplete = () => {
    setShowInstallProgress(false);
    setShowInstallComplete(true);
  };

  const handleInstallComplete = () => {
    clearAllStates();
    // Trigger status refresh
    fetchStatus();
  };

  const handleStopInstallation = async () => {
    try {
      // Set operation to rollback
      setCurrentOperation('install'); // Keep as install but show rollback progress
      setOperationInProgress(true);
      
      // Clear terminal output and reset progress for rollback
      setTerminalOutput([]);
      setInstallProgress(0);
      
      // Call the stop endpoint
      const response = await fetch('/api/takserver/stop-installation', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to stop installation: ${response.statusText}`);
      }

    } catch (error) {
      console.error('Stop installation error:', error);
      setInstallError(error instanceof Error ? error.message : 'Failed to stop installation');
    }
  };

  // Restore button states on mount
  useEffect(() => {
    const storedButtonState = localStorage.getItem('takServerButtonState');
    if (storedButtonState) {
      try {
        const { operationInProgress, currentOperation } = JSON.parse(storedButtonState);
        setOperationInProgress(operationInProgress);
        setCurrentOperation(currentOperation);
      } catch (error) {
        console.error('Error restoring button state:', error);
      }
    }
  }, []);

  // Subscribe to SSE events
  useEffect(() => {
    const eventSource = new EventSource('/stream');

    // Handle terminal output events
    eventSource.addEventListener('takserver-terminal', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          const terminalLine = {
            message: data.message,
            isError: data.isError || false,
            timestamp: data.timestamp || Date.now()
          };

          // Add to the appropriate terminal output based on the current operation
          if (currentOperation === 'uninstall') {
            setUninstallTerminalOutput(prev => {
              const newOutput = [...prev, terminalLine];
              // Save to localStorage immediately
              const state = JSON.parse(localStorage.getItem('takServerOperationState') || '{}');
              localStorage.setItem('takServerOperationState', JSON.stringify({
                ...state,
                uninstallTerminalOutput: newOutput
              }));
              return newOutput;
            });
            setShowUninstallProgress(true);
          } else {
            setTerminalOutput((prev: TerminalLine[]) => {
              const newOutput = [...prev, terminalLine];
              // Save to localStorage immediately
              const state = JSON.parse(localStorage.getItem('takServerOperationState') || '{}');
              localStorage.setItem('takServerOperationState', JSON.stringify({
                ...state,
                terminalOutput: newOutput
              }));
              return newOutput;
            });
            setShowInstallProgress(true);
          }
        }
      } catch (error) {
        console.error('Error parsing terminal event:', error);
      }
    });

    // Handle installation events
    eventSource.addEventListener('takserver-install', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.operation === 'install') {
          setInstallProgress(data.progress);
          setShowInstallProgress(true);
          
          if (data.status === 'error') {
            setInstallError(data.error || data.message);
          }
        } else if (data.operation === 'rollback') {
          // Clear existing terminal output when rollback starts
          if (data.status === 'in_progress' && data.progress === 0) {
            setTerminalOutput([]);
            setInstallProgress(0);
          }
          
          // Update progress for rollback
          setInstallProgress(data.progress);
          
          if (data.status === 'error') {
            setInstallError(data.error || data.message);
            setShowInstallProgress(false);
            setShowInstallComplete(true);
          } else if (data.status === 'complete') {
            // Rollback complete
            setShowInstallProgress(false);
            clearAllStates();
            // Refresh server status
            fetchStatus();
          }
        }
      } catch (error) {
        console.error('Error parsing installation event:', error);
      }
    });

    // Handle uninstallation events
    eventSource.addEventListener('takserver-uninstall', (event) => {
      try {
        const data = JSON.parse(event.data);
        setUninstallProgress(data.progress || 0);
        setShowUninstallProgress(true);
        
        if (data.status === 'error') {
          setUninstallError(data.error || data.message);
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    });

    // Handle status events
    eventSource.addEventListener('takserver-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle status updates
        if ('isInstalled' in data && 'isRunning' in data) {
          setServerState((prevState: TakServerState) => ({
            ...prevState,
            isInstalled: data.isInstalled,
            isRunning: data.isRunning,
            version: data.version || undefined,
            status: data.status,
            error: data.error || null
          }));
        }
        
        // Handle operation status updates
        if ('status' in data && 'operation' in data) {
          if (data.status === 'in_progress') {
            setOperationInProgress(true);
            setCurrentOperation(data.operation);
            setOperationError(undefined);
            
            // Ensure correct popup is shown
            if (data.operation === 'uninstall') {
              setShowUninstallProgress(true);
            } else if (data.operation === 'install' || data.operation === 'rollback') {
              setShowInstallProgress(true);
            }
          } else if (data.status === 'completed' || data.status === 'error') {
            if (data.operation === 'rollback') {
              // For rollback, just clear states and close dialogs
              clearAllStates();
            } else if (currentOperation === 'uninstall') {
              setShowUninstallProgress(false);
              setShowUninstallComplete(true);
            } else if (currentOperation === 'install') {
              setShowInstallProgress(false);
              setShowInstallComplete(true);
            } else {
              clearAllStates();
            }
            
            if (data.status === 'error') {
              setOperationError(data.message || 'Operation failed');
            } else {
              setOperationError(undefined);
            }
            
            // Get actual server state
            fetchStatus();
          }
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    });

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [currentOperation]);

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
            onUninstall={handleUninstall}
            onRestart={handleRestartClick}
            onStartStop={handleStartStopClick}
            onInstall={() => setShowInstallForm(true)}
            disabled={operationInProgress}
            currentOperation={currentOperation}
            setShowUninstallConfirm={setShowUninstallConfirm}
          />
        </div>
      </div>

      {!serverState.isInstalled && showInstallForm && (
        <div>
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
        onMoveToInstallComplete={handleMoveToInstallComplete}
        terminalOutput={terminalOutput}
        onStopInstallation={handleStopInstallation}
        
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
        uninstallTerminalOutput={uninstallTerminalOutput}
      />
    </>
  );
};

export default TakServerStatus; 