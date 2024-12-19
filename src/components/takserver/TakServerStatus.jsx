import React, { useState, useRef, useEffect } from 'react';
import InputField from '../shared/ui/InputField';
import Popup from '../shared/ui/popups/Popup';
import AdvancedFeatures from './AdvancedFeatures';
import Configuration from './Configuration';
import DockerPopup from '../shared/ui/popups/DockerPopup';
import Button from '../shared/ui/Button';
import LoadingButton from '../shared/ui/LoadingButton';
import useSocket, { BACKEND_EVENTS } from '../shared/hooks/useSocket';
import InstallationPopup from './InstallationPopup';
import UninstallationPopup from './UninstallationPopup';
import useFetch from '../shared/hooks/useFetch';

function TakServerStatus() {
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [showInstallProgress, setShowInstallProgress] = useState(false);
  const terminalRef = useRef(null);
  const [formData, setFormData] = useState({
    docker_zip_file: null,
    postgres_password: '',
    certificate_password: '',
    organization: '',
    state: '',
    city: '',
    organizational_unit: '',
    name: ''
  });
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [operationError, setOperationError] = useState(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const { post, error: fetchError, clearError } = useFetch();

  // TAK Server Status Socket
  const {
    state: takState,
    updateState: updateTakState,
    error: takError,
    isConnected: isTakConnected,
    emit: emitTakStatus
  } = useSocket(BACKEND_EVENTS.TAKSERVER_STATUS.namespace, {
    initialState: {
      isInstalled: false,
      isRunning: false,
      isStarting: false,
      isStopping: false,
      isRestarting: false,
      error: null,
      dockerRunning: false,
      version: null,
      status: null,
      operationInProgress: false
    },
    eventHandlers: {
      'initial_state': (data, { updateState }) => {
        console.info('Received TAK Server initial state:', data);
        const isOperationInProgress = data.isStarting || data.isStopping || data.isRestarting;
        const status = isOperationInProgress 
          ? (data.isStopping ? 'stopping' : data.isRestarting ? 'restarting' : 'starting')
          : null;
        
        updateState({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          dockerRunning: data.dockerRunning,
          version: data.version,
          error: data.error || null,
          status,
          operationInProgress: isOperationInProgress,
          isStarting: data.isStarting || false,
          isStopping: data.isStopping || false,
          isRestarting: data.isRestarting || false
        });
        
        if (data.error) {
          setOperationError(data.error);
        }
      },

      onConnect: () => {
        console.log('Connected to TAK server status service');
      },
      connect: () => {
        console.log('TAK server status socket connected/reconnected');
      },
      [BACKEND_EVENTS.TAKSERVER_STATUS.events.STATUS_UPDATE]: (data, { state, updateState }) => {
        console.info('TAK Server Status:', {
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          status: data.status,
          currentState: state
        });
        
        // Only update if there are actual changes
        const isOperationInProgress = data.isStarting || data.isStopping || data.isRestarting;
        const status = isOperationInProgress 
          ? (data.isStopping ? 'stopping' : data.isRestarting ? 'restarting' : 'starting')
          : null;
        
        if (state.isInstalled !== data.isInstalled ||
            state.isRunning !== data.isRunning ||
            state.dockerRunning !== data.dockerRunning ||
            state.version !== data.version ||
            state.error !== data.error ||
            state.status !== status) {
          
          updateState({
            isInstalled: data.isInstalled,
            isRunning: data.isRunning,
            dockerRunning: data.dockerRunning,
            version: data.version,
            error: data.error || null,
            status,
            operationInProgress: isOperationInProgress
          });
          
          if (data.error) {
            setOperationError(data.error);
          } else {
            setOperationError(null);
          }
        }
      }
    }
  });

  // TAK Server Installation Socket
  const {
    state: installState,
    updateState: updateInstallState,
    emit: emitInstall,
    terminalOutput: installTerminalOutput,
    appendToTerminal: appendInstallOutput,
    clearTerminal: clearInstallOutput,
    isConnected: isInstallConnected,
    error: installError
  } = useSocket(BACKEND_EVENTS.TAKSERVER_INSTALLER.namespace, {
    initialState: {
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      installationError: null,
      isRollingBack: false,
      isStoppingInstallation: false,
      status: null,
      operationInProgress: false,
      dockerInstalled: false
    },
    eventHandlers: {
      'initial_state': (data, { updateState }) => {
        console.log('Received installer initial state:', data);
        updateState({
          isInstalling: data.isInstalling,
          installationComplete: data.installationComplete || false,
          installationSuccess: data.installationSuccess || false,
          installationError: data.error || null,
          isRollingBack: data.isRollingBack || false,
          isStoppingInstallation: data.isStoppingInstallation || false,
          status: data.status,
          operationInProgress: data.operationInProgress,
          dockerInstalled: data.dockerInstalled || false
        });
      },

      onConnect: () => {
        console.log('Connected to installer service');
      },
      [BACKEND_EVENTS.TAKSERVER_INSTALLER.events.DOCKER_STATUS]: (data, { state, updateState }) => {
        updateState({
          isInstalling: data.isInstalling,
          installationComplete: data.installationComplete || false,
          installationSuccess: data.installationSuccess || false,
          installationError: data.error || null,
          status: data.status,
          operationInProgress: data.isInstalling
        });
      }
    }
  });

  // TAK Server Uninstall Socket
  const {
    state: uninstallState,
    updateState: updateUninstallState,
    emit: emitUninstall,
    terminalOutput: uninstallTerminalOutput,
    appendToTerminal: appendUninstallOutput,
    clearTerminal: clearUninstallTerminal,
    isConnected: isUninstallConnected,
    error: uninstallError
  } = useSocket(BACKEND_EVENTS.TAKSERVER_UNINSTALL.namespace, {
    initialState: {
      isUninstalling: false,
      uninstallComplete: false,
      uninstallSuccess: false,
      uninstallError: null,
      status: null,
      operationInProgress: false
    },
    eventHandlers: {
      'initial_state': (data, { updateState }) => {
        console.log('Received uninstaller initial state:', data);
        updateState({
          isUninstalling: data.isUninstalling,
          uninstallComplete: data.uninstallComplete || false,
          uninstallSuccess: data.uninstallSuccess || false,
          uninstallError: data.error || null,
          status: data.status,
          operationInProgress: data.operationInProgress
        });
      },

      onConnect: () => {
        console.log('Connected to uninstall service');
        appendUninstallOutput('✓ Connected to uninstall service');
      },
      [BACKEND_EVENTS.TAKSERVER_UNINSTALL.events.STATUS_UPDATE]: (data, { state, updateState }) => {
        console.info('Uninstall Status:', {
          isUninstalling: data.isUninstalling,
          status: data.status,
          currentState: state
        });
        
        updateState({
          isUninstalling: data.isUninstalling,
          uninstallComplete: data.uninstallComplete || false,
          uninstallSuccess: data.uninstallSuccess || false,
          uninstallError: data.error || null,
          status: data.status,
          operationInProgress: data.isUninstalling
        });
      },
      [BACKEND_EVENTS.TAKSERVER_UNINSTALL.events.COMPLETE]: (data, { state, updateState }) => {
        updateState({
          isUninstalling: false,
          uninstallComplete: true,
          uninstallSuccess: data.success,
          uninstallError: data.success ? null : data.message,
          status: null,
          operationInProgress: false
        });
        
        if (data.success) {
          setShowNextButton(true);
          appendUninstallOutput('✓ TAK Server uninstallation completed successfully');
        } else {
          appendUninstallOutput(`Error: ${data.message}`);
        }
      },
      handleTerminalOutput: true,
      onError: (error) => {
        updateUninstallState({
          uninstallError: error.message || 'Failed to connect to uninstall service',
          status: 'error',
          operationInProgress: false
        });
      }
    }
  });

  // Clear fetch errors when component unmounts or when error state changes
  useEffect(() => {
    return () => {
      if (fetchError) {
        clearError();
      }
    };
  }, [fetchError, clearError]);

  const handleInputChange = (e) => {
    const { id, value, files, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'file' ? files[0] : value
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
      name: ''
    });
  };

  const handleNext = () => {
    if (uninstallState.isUninstalling || uninstallState.uninstallComplete) {
      // For uninstallation flow
      setShowInstallProgress(false);
      setShowUninstallConfirm(false);
      setShowCompletionPopup(true);
    } else {
      // For installation flow
      setShowInstallProgress(false);
      setShowCompletionPopup(true);
    }
  };

  const handleInstall = async () => {
    try {
      const formDataToSend = new FormData();
      
      // Validate file first
      if (!formData.docker_zip_file || !formData.docker_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid TAK Server ZIP file');
      }

      // Validate other required fields
      const requiredFields = [
        'postgres_password',
        'certificate_password',
        'organization',
        'organizational_unit',
        'state',
        'city',
        'name'
      ];

      const missingFields = requiredFields.filter(field => !formData[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Clear previous terminal output and show progress popup
      clearInstallOutput();
      setShowInstallForm(false);
      setShowInstallProgress(true);

      // Append file with proper name
      formDataToSend.append('docker_zip_file', formData.docker_zip_file, formData.docker_zip_file.name);
      
      // Append other form fields
      requiredFields.forEach(field => {
        formDataToSend.append(field, formData[field]);
      });

      const response = await post('/api/takserver/install-takserver', formDataToSend, {
        validateResponse: (data) => ({
          isValid: !!data?.installation_id,
          error: !data?.installation_id ? 'No installation ID received from server' : undefined
        })
      });

      // Start installation
      emitInstall('start_installation', { installation_id: response.installation_id });

    } catch (error) {
      console.error('Installation error:', error);
      updateInstallState({
        isInstalling: false,
        installationError: error.message || 'Installation failed'
      });
      setShowNextButton(true);
    }
  };

  const handleCancelInstallation = async () => {
    try {
      if (!installState.isInstalling) {
        console.error('Cannot stop installation: Installation not in progress');
        return;
      }

      updateInstallState({ isStoppingInstallation: true });
      
      await post('/api/takserver/rollback-takserver', null, {
        validateResponse: (data) => ({
          isValid: true // Any response is valid for rollback
        })
      });

    } catch (error) {
      console.error('Error stopping installation:', error);
      updateInstallState({
        isStoppingInstallation: false,
        installationError: error.message
      });
      setShowNextButton(true);
    }
  };

  const handleStartStopClick = async () => {
    try {
      setOperationError(null);
      const isStarting = !takState.isRunning;
      
      // Set initial loading state
      updateTakState({
        ...takState,
        isStarting: isStarting,
        isStopping: !isStarting,
        error: null
      });
      
      const endpoint = takState.isRunning ? '/api/takserver/takserver-stop' : '/api/takserver/takserver-start';
      
      await post(endpoint, null, {
        validateResponse: (data) => ({
          isValid: true
        })
      });
      
    } catch (error) {
      // Reset loading state on error
      updateTakState({
        ...takState,
        isStarting: false,
        isStopping: false,
        error: error.message || 'Operation failed'
      });
      setOperationError(error.message || 'Operation failed');
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(null);
      
      // Set initial loading state
      updateTakState({
        ...takState,
        isRestarting: true,
        error: null
      });
      
      await post('/api/takserver/takserver-restart', null, {
        validateResponse: (data) => ({
          isValid: true
        })
      });
      
    } catch (error) {
      // Reset loading state on error
      updateTakState({
        ...takState,
        isRestarting: false,
        error: error.message || 'Restart failed'
      });
      setOperationError(error.message || 'Restart failed');
    }
  };

  const handleUninstall = () => {
    setShowUninstallConfirm(false);
    setShowInstallProgress(true);
    clearUninstallTerminal();
    updateUninstallState({
      uninstallComplete: false,
      uninstallSuccess: false,
      uninstallError: null
    });
    emitUninstall('start_uninstall');
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4">TAK Server Status</h3>
            <div className="flex flex-col gap-2 mb-4">
              {takState.isInstalled ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <div className="flex items-center gap-2">
                      {takState.isStarting || takState.isStopping || takState.isRestarting ? (
                        <span className={`text-sm ${
                          takState.isStarting ? "text-green-500" :
                          takState.isRestarting ? "text-yellow-500" :
                          "text-red-500"
                        }`}>
                          {takState.isStarting ? "Starting..." :
                           takState.isRestarting ? "Restarting..." :
                           "Stopping..."}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {takState.isRunning ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm text-green-500">Running</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              <span className="text-sm text-red-500">Stopped</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {operationError && (
                    <div className="text-sm text-red-500">
                      Error: {operationError}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Installation:</span>
                  <span className="text-sm text-red-500">
                    Not Installed
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-start gap-4">
            {takState.isInstalled ? (
              <>
                <Button
                  onClick={() => setShowUninstallConfirm(true)}
                  disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                  variant="danger"
                >
                  Uninstall
                </Button>
                {takState.isRunning && (
                  <>
                    <LoadingButton
                      onClick={handleRestartClick}
                      disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                      isLoading={takState.isRestarting}
                      operation="restart"
                      variant="primary"
                      className="hover:bg-yellow-500"
                    >
                      Restart
                    </LoadingButton>
                    <LoadingButton
                      onClick={handleStartStopClick}
                      disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                      isLoading={takState.isStopping}
                      operation="stop"
                      variant="primary"
                      className="hover:bg-red-500"
                    >
                      Stop
                    </LoadingButton>
                  </>
                )}
                {!takState.isRunning && (
                  <LoadingButton
                    onClick={handleStartStopClick}
                    disabled={takState.isStarting || takState.isStopping || takState.isRestarting}
                    isLoading={takState.isStarting}
                    operation="start"
                    variant="primary"
                    className="hover:bg-green-500"
                  >
                    Start
                  </LoadingButton>
                )}
              </>
            ) : (
              <Button
                onClick={() => setShowInstallForm(true)}
                variant="primary"
                className="hover:bg-green-500"
              >
                Install TAK Server
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Docker Error Popup */}
      <DockerPopup 
        isVisible={true}
      />

      {/* Uninstall Confirmation Popup */}
      <Popup
        id="uninstall-confirm-popup"
        title="Confirm Uninstall"
        isVisible={showUninstallConfirm}
        onClose={() => setShowUninstallConfirm(false)}
        variant="standard"
        blurSidebar={true}
        buttons={
          <>
            <Button
              onClick={() => setShowUninstallConfirm(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUninstall}
              variant="danger"
            >
              Uninstall
            </Button>
          </>
        }
      >
        <div className="text-center">
          <p className="text-red-500 font-semibold">
            Warning: This action cannot be undone
          </p>
          <p className="text-sm text-gray-300">
            Uninstalling TAK Server will remove all server data, configurations, and certificates.
            Are you sure you want to proceed?
          </p>
        </div>
      </Popup>

      {/* Installation Form Popup */}
      {!takState.isInstalled && showInstallForm && (
        <div className="w-full border border-border bg-card p-6 rounded-lg">
          <h3 className="text-base font-bold mb-4">Installation Configuration</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                TAK Server is a powerful middleware solution that enables real-time situational awareness and information sharing. 
                It acts as a central hub for connecting ATAK clients, managing user authentication, and facilitating secure data exchange between team members. 
                The server provides essential features like data persistence, user management, and mission data sharing capabilities.
              </p>
            </div>

            {/* Installation Summary */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Installation Summary</h4>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                <li>This will install TAK Server and PostgreSQL database within Docker Desktop</li>
                <li>Certificate enrollment will be configured by default for client authentication</li>
                <li>All data will be stored in your Documents folder using Docker volumes</li>
                <li>For the TAK Server ZIP file, please download the Docker version from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-textSecondary">TAK.gov</a></li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm text-yellow-400 mb-2">
              All fields are required
            </div>

            {/* File Upload Section */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">
                Docker ZIP File <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-textSecondary">Example: takserver-docker-5.2-RELEASE-43.zip</p>
              <input
                type="file"
                id="docker_zip_file"
                onChange={handleInputChange}
                className="w-full text-sm p-2 rounded-lg bg-inputBg border border-inputBorder focus:border-accentBorder focus:outline-none"
                accept=".zip"
                required
              />
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Password Fields */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Database Password <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="postgres_password"
                  type="password"
                  value={formData.postgres_password}
                  onChange={handleInputChange}
                  placeholder="Enter PostgreSQL password"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Certificate Password <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="certificate_password"
                  type="password"
                  value={formData.certificate_password}
                  onChange={handleInputChange}
                  placeholder="Enter certificate password"
                  className="w-full"
                />
              </div>

              {/* Organization Details */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Organization <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="organization"
                  type="text"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder="Enter organization name"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Organizational Unit <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="organizational_unit"
                  type="text"
                  value={formData.organizational_unit}
                  onChange={handleInputChange}
                  placeholder="Enter organizational unit"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  State/Province <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="state"
                  type="text"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="Enter state or province"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  City <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Enter city"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Name <span className="text-red-500">*</span>
                </label>
                <InputField
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter administrator name"
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-4">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="hover:bg-red-500"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInstall}
                variant="primary"
                className="hover:bg-green-500"
              >
                Begin Installation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show AdvancedFeatures and Configuration only when installed */}
      {takState.isInstalled && (
        <>
          <AdvancedFeatures />
          <Configuration />
        </>
      )}

      {/* Terminal Progress Popups */}
      <InstallationPopup
        isVisible={showInstallProgress && !uninstallState.isUninstalling && !uninstallState.uninstallComplete}
        terminalOutput={installTerminalOutput}
        terminalRef={terminalRef}
        isInProgress={installState.isInstalling}
        isComplete={!installState.isInstalling && (installState.installationSuccess || installState.installationError)}
        isSuccess={installState.installationSuccess}
        errorMessage={installState.installationError}
        onNext={handleNext}
        onStop={handleCancelInstallation}
        isStoppingInstallation={installState.isStoppingInstallation}
        showNextButton={showNextButton}
      />

      <UninstallationPopup
        isVisible={showInstallProgress && (uninstallState.isUninstalling || uninstallState.uninstallComplete)}
        terminalOutput={uninstallTerminalOutput}
        terminalRef={terminalRef}
        isInProgress={uninstallState.isUninstalling}
        isComplete={uninstallState.uninstallComplete}
        isSuccess={uninstallState.uninstallSuccess}
        errorMessage={uninstallState.uninstallError}
        onNext={handleNext}
        showNextButton={showNextButton || uninstallState.uninstallSuccess}
      />

      {/* Completion Popup */}
      <Popup
        id="completion-popup"
        title={uninstallState.uninstallComplete ? "Uninstallation Complete" : "Installation Complete"}
        isVisible={showCompletionPopup}
        variant="standard"
        onClose={() => {
          setShowCompletionPopup(false);
          // Reset all states after closing completion popup
          if (uninstallState.uninstallComplete) {
            updateUninstallState({
              uninstallComplete: false,
              uninstallSuccess: false,
              uninstallError: null
            });
          }
          handleClose();
        }}
        blurSidebar={true}
        buttons={
          <Button
            onClick={() => {
              setShowCompletionPopup(false);
              // Reset all states after closing completion popup
              if (uninstallState.uninstallComplete) {
                updateUninstallState({
                  uninstallComplete: false,
                  uninstallSuccess: false,
                  uninstallError: null
                });
              }
              handleClose();
            }}
            variant="primary"
            className="hover:bg-green-500"
          >
            Close
          </Button>
        }
      >
        <div className="text-center">
          {(uninstallState.uninstallComplete && uninstallState.uninstallSuccess) || (!uninstallState.uninstallComplete && installState.installationSuccess) ? (
            <>
              <p className="text-green-500 font-semibold">✓</p>
              <p className="text-green-500 font-semibold">
                {uninstallState.uninstallComplete
                  ? 'TAK Server Uninstallation Completed Successfully'
                  : 'TAK Server Installation Completed Successfully'
                }
              </p>
              <p className="text-sm text-gray-300">
                {uninstallState.uninstallComplete
                  ? 'TAK Server has been completely removed from your system.'
                  : 'You can now start using your TAK Server and configure additional features.'
                }
              </p>
            </>
          ) : (
            <>
              <p className="text-red-500 font-semibold">✗</p>
              <p className="text-red-500 text-sm font-semibold">
                {uninstallState.uninstallComplete
                  ? 'TAK Server Uninstallation Failed'
                  : 'TAK Server Installation Failed'
                }
              </p>
            </>
          )}
        </div>
      </Popup>
    </>
  );
}

export default TakServerStatus; 