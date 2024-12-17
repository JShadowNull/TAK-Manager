import React, { useState, useRef, useEffect } from 'react';
import InputField from '../shared/ui/InputField';
import Popup from '../shared/ui/popups/Popup';
import AdvancedFeatures from './AdvancedFeatures';
import Configuration from './Configuration';
import DockerPopup from '../shared/ui/popups/DockerPopup';
import Button from '../shared/ui/Button';
import useSocket from '../../hooks/useSocket';
import io from 'socket.io-client';
import InstallationPopup from './InstallationPopup';
import UninstallationPopup from './UninstallationPopup';
import useFetch from '../../hooks/useFetch';

function TakServerStatus({ handleStartStop }) {
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
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationId, setInstallationId] = useState(null);
  const [isStoppingInstallation, setIsStoppingInstallation] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [installationSuccessful, setInstallationSuccessful] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [operationError, setOperationError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [dockerError, setDockerError] = useState(null);
  const [dockerStatus, setDockerStatus] = useState({
    isInstalled: false,
    isRunning: false,
    error: null
  });
  const [isStartingDocker, setIsStartingDocker] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallComplete, setUninstallComplete] = useState(false);
  const [uninstallSuccess, setUninstallSuccess] = useState(false);
  const [uninstallError, setUninstallError] = useState(null);
  const [installationFailed, setInstallationFailed] = useState(false);
  const [installationError, setInstallationError] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const { post, loading: fetchLoading, error: fetchError } = useFetch();

  // Docker Manager Socket
  const {
    state: dockerState,
    updateState: updateDockerState,
    isConnected: isDockerConnected,
  } = useSocket('/docker-manager', {
    initialState: {
      isInstalled: false,
      isRunning: false,
      error: null
    },
    eventHandlers: {
      docker_status: (status, { updateState }) => {
        updateState({
          isInstalled: status.isInstalled,
          isRunning: status.isRunning,
          error: status.error
        });
        setDockerStatus({
          isInstalled: status.isInstalled,
          isRunning: status.isRunning,
          error: status.error
        });
        // Connect TAK server sockets when Docker is ready
        if (status.isInstalled && status.isRunning) {
          setDockerError(null);
        }
      },
      onError: (error) => {
        console.error('Docker manager socket connection error:', error);
        setDockerStatus(prev => ({
          ...prev,
          error: 'Failed to connect to Docker status service'
        }));
      }
    }
  });

  // TAK Server Status Socket
  const {
    state: takState,
    updateState: updateTakState,
    error: takError,
  } = useSocket('/takserver-status', {
    initialState: {
      isInstalled: false,
      isRunning: false,
      isStarting: false,
      isStopping: false,
      isRestarting: false,
      error: null
    },
    eventHandlers: {
      onConnect: (socket) => {
        console.log('Connected to TAK server status service');
        socket.emit('check_status');
      },
      takserver_status: (status, { updateState }) => {
        updateState({
          isInstalled: status.isInstalled,
          isRunning: status.isRunning,
          isStarting: status.isStarting || false,
          isStopping: status.isStopping || false,
          isRestarting: status.isRestarting || false,
          error: status.error
        });
        
        // Update component state
        setIsInstalled(status.isInstalled);
        setIsRunning(status.isRunning);
        setIsStarting(status.isStarting || false);
        setIsStopping(status.isStopping || false);
        setIsRestarting(status.isRestarting || false);
        
        if (status.error) {
          setOperationError(status.error);
          // Reset operation states on error
          setIsStarting(false);
          setIsStopping(false);
          setIsRestarting(false);
        }
      }
    }
  });

  // TAK Server Uninstall Socket
  const {
    state: uninstallState,
    updateState: updateUninstallState,
    emit: emitUninstall,
    terminalOutput,
    appendToTerminal,
    clearTerminal,
  } = useSocket('/takserver-uninstall', {
    initialState: {
      isUninstalling: false,
      uninstallComplete: false,
      uninstallSuccess: false,
      uninstallError: null
    },
    eventHandlers: {
      onConnect: () => {
        console.log('Connected to uninstall service');
        appendToTerminal('✓ Connected to uninstall service');
      },
      uninstall_status: (status, { updateState }) => {
        updateState({ isUninstalling: status.isUninstalling });
        setIsUninstalling(status.isUninstalling);
      },
      uninstall_complete: (result, { updateState }) => {
        updateState({
          isUninstalling: false,
          uninstallComplete: true,
          uninstallSuccess: result.success,
          uninstallError: result.success ? null : result.message
        });
        
        setIsUninstalling(false);
        setUninstallComplete(true);
        if (result.success) {
          setUninstallSuccess(true);
          setShowNextButton(true);
          appendToTerminal('✓ TAK Server uninstallation completed successfully');
        } else {
          setUninstallError(result.message);
          appendToTerminal(`Error: ${result.message}`);
        }
      },
      handleTerminalOutput: true // Explicitly enable terminal output handling
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
  } = useSocket('/takserver-installer', {
    initialState: {
      isInstalling: false,
      installationComplete: false,
      installationSuccess: false,
      installationError: null,
      isRollingBack: false
    },
    eventHandlers: {
      onConnect: () => {
        console.log('Connected to installer service');
      },
      installation_started: () => {
        setIsInstalling(true);
        setInstallationFailed(false);
        setInstallationError(null);
        setShowNextButton(false);
        setInstallationSuccessful(false);
        setIsStoppingInstallation(false);
      },
      installation_complete: (data) => {
        setIsInstalling(false);
        setInstallationSuccessful(true);
        setIsStoppingInstallation(false);
        setShowNextButton(data.status === 'success');
      },
      installation_failed: (data) => {
        setIsInstalling(false);
        setInstallationFailed(true);
        setInstallationError(data.error);
        setShowNextButton(false);
        setInstallationSuccessful(false);
        setIsStoppingInstallation(false);
      },
      rollback_started: () => {
        setIsRollingBack(true);
        setShowNextButton(false);
        setInstallationSuccessful(false);
      },
      rollback_complete: () => {
        setIsRollingBack(false);
        setIsStoppingInstallation(false);
        setIsInstalling(false);
        setInstallationFailed(true);
        setInstallationError('Installation cancelled by user');
        setShowNextButton(true);
        appendInstallOutput('Rollback completed successfully');
      },
      rollback_failed: (data) => {
        setIsRollingBack(false);
        setIsStoppingInstallation(false);
        setInstallationError(data.error || 'Rollback failed');
        setShowNextButton(true);
        setInstallationSuccessful(false);
        appendInstallOutput(`Rollback failed: ${data.error || 'Unknown error'}`);
      },
      handleTerminalOutput: true
    }
  });

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
    if (isUninstalling || uninstallComplete) {
      // For uninstallation flow
      setShowInstallProgress(false);
      setShowUninstallConfirm(false);
      setShowCompletionPopup(true);
      // Keep uninstall states for completion popup
      setIsUninstalling(false);
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

      // Reset installation states
      setInstallationId(null);
      setIsInstalling(false);
      setInstallationFailed(false);
      setInstallationError(null);
      setIsStoppingInstallation(false);
      setIsRollingBack(false);
      setShowNextButton(false);

      // Append file with proper name
      formDataToSend.append('docker_zip_file', formData.docker_zip_file, formData.docker_zip_file.name);
      
      // Append other form fields
      requiredFields.forEach(field => {
        formDataToSend.append(field, formData[field]);
      });

      const data = await post('/api/takserver/install-takserver', formDataToSend);
      
      if (!data.installation_id) {
        throw new Error('No installation ID received from server');
      }

      // Set installation ID and start installation
      setInstallationId(data.installation_id);
      setIsInstalling(true);

    } catch (error) {
      console.error('Installation error:', error.message);
      setIsInstalling(false);
      setInstallationFailed(true);
      setInstallationError(error.message);
      setShowNextButton(true);
    }
  };

  const handleCancelInstallation = async () => {
    try {
      // Check if we can stop the installation
      if (!installationId) {
        console.error('Cannot stop installation: No installation ID');
        return;
      }

      if (!isInstalling) {
        console.error('Cannot stop installation: Installation not in progress');
        return;
      }

      if (isStoppingInstallation) {
        console.error('Cannot stop installation: Already stopping');
        return;
      }

      // Set stopping state
      setIsStoppingInstallation(true);

      await post('/api/takserver/rollback-takserver', { 
        installation_id: installationId 
      });

    } catch (error) {
      console.error('Error stopping installation:', error);
      setIsStoppingInstallation(false);
      setInstallationFailed(true);
      setInstallationError(error.message);
      setShowNextButton(true);
    }
  };

  const handleStartStopClick = async () => {
    try {
      setOperationError(null);
      // Set loading state immediately
      if (isRunning) {
        setIsStopping(true);
      } else {
        setIsStarting(true);
      }

      const endpoint = isRunning ? '/api/takserver/takserver-stop' : '/api/takserver/takserver-start';
      await post(endpoint);
      
    } catch (error) {
      setOperationError(error.message);
      // Reset loading state on error
      setIsStarting(false);
      setIsStopping(false);
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(null);
      // Set loading state immediately
      setIsRestarting(true);

      await post('/api/takserver/takserver-restart');
      
    } catch (error) {
      setOperationError(error.message);
      // Reset loading state on error
      setIsRestarting(false);
    }
  };

  const handleUninstall = () => {
    setShowUninstallConfirm(false);
    setShowInstallProgress(true);
    clearTerminal();
    setUninstallComplete(false);
    setUninstallSuccess(false);
    setUninstallError(null);
    emitUninstall('start_uninstall');
  };

  const handleUninstallComplete = () => {
    setShowInstallProgress(false);
    setShowCompletionPopup(true);
    clearTerminal();
    setIsUninstalling(false);
  };

  const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-4 w-4 border-2 border-buttonTextColor border-t-transparent"/>
  );

  return (
    <>
      <div className="w-full border border-accentBoarder bg-card p-6 rounded-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4">TAK Server Status</h3>
            <div className="flex flex-col gap-2 mb-4">
              {isInstalled ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <div className="flex items-center gap-2">
                      {isStarting || isStopping || isRestarting ? (
                        <span className={`text-sm ${
                          isStarting ? "text-green-500" :
                          isRestarting ? "text-yellow-500" :
                          "text-red-500"
                        }`}>
                          {isStarting ? "Starting..." :
                           isRestarting ? "Restarting..." :
                           "Stopping..."}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isRunning ? (
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
            {isInstalled ? (
              <>
                <Button
                  onClick={() => setShowUninstallConfirm(true)}
                  disabled={isStarting || isStopping || isRestarting || isUninstalling}
                  variant="danger"
                >
                  Uninstall
                </Button>
                {isRunning && (
                  <>
                    <Button
                      onClick={handleRestartClick}
                      disabled={isStarting || isStopping || isRestarting || isUninstalling}
                      loading={isRestarting}
                      loadingText="Restarting TAK Server..."
                      variant="primary"
                      className="hover:bg-yellow-500"
                    >
                      Restart
                    </Button>
                    <Button
                      onClick={handleStartStopClick}
                      disabled={isStarting || isStopping || isRestarting || isUninstalling}
                      loading={isStopping}
                      loadingText="Stopping TAK Server..."
                      variant="primary"
                      className="hover:bg-red-500"
                    >
                      Stop
                    </Button>
                  </>
                )}
                {!isRunning && (
                  <Button
                    onClick={handleStartStopClick}
                    disabled={isStarting || isStopping || isRestarting || isUninstalling}
                    loading={isStarting}
                    loadingText="Starting TAK Server..."
                    variant="primary"
                    className="hover:bg-green-500"
                  >
                    Start
                  </Button>
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
        isVisible={!dockerStatus.isInstalled || !dockerStatus.isRunning}
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
      {!isInstalled && showInstallForm && (
        <div className="w-full border border-accentBoarder bg-card p-6 rounded-lg">
          <h3 className="text-base font-bold mb-4">Installation Configuration</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-background border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                TAK Server is a powerful middleware solution that enables real-time situational awareness and information sharing. 
                It acts as a central hub for connecting ATAK clients, managing user authentication, and facilitating secure data exchange between team members. 
                The server provides essential features like data persistence, user management, and mission data sharing capabilities.
              </p>
            </div>

            {/* Installation Summary */}
            <div className="bg-background border border-accentBoarder p-4 rounded-lg mb-4">
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
      {isInstalled && (
        <>
          <AdvancedFeatures />
          <Configuration />
        </>
      )}

      {/* Terminal Progress Popups */}
      <InstallationPopup
        isVisible={showInstallProgress && !isUninstalling && !uninstallComplete}
        terminalOutput={installTerminalOutput}
        terminalRef={terminalRef}
        isInProgress={isInstalling}
        isComplete={!isInstalling && (installationSuccessful || installationFailed)}
        isSuccess={installationSuccessful}
        errorMessage={installationError}
        onNext={handleNext}
        onStop={handleCancelInstallation}
        isStoppingInstallation={isStoppingInstallation}
        showNextButton={showNextButton}
      />

      <UninstallationPopup
        isVisible={showInstallProgress && (isUninstalling || uninstallComplete)}
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        isInProgress={isUninstalling}
        isComplete={uninstallComplete}
        isSuccess={uninstallSuccess}
        errorMessage={uninstallError}
        onNext={handleNext}
        showNextButton={showNextButton || uninstallSuccess}
      />

      {/* Completion Popup */}
      <Popup
        id="completion-popup"
        title={uninstallComplete ? "Uninstallation Complete" : "Installation Complete"}
        isVisible={showCompletionPopup}
        variant="standard"
        onClose={() => {
          setShowCompletionPopup(false);
          // Reset all states after closing completion popup
          if (uninstallComplete) {
            setUninstallComplete(false);
            setUninstallSuccess(false);
            setUninstallError(null);
            setIsInstalled(false);
          }
          handleClose();
        }}
        blurSidebar={true}
        buttons={
          <Button
            onClick={() => {
              setShowCompletionPopup(false);
              // Reset all states after closing completion popup
              if (uninstallComplete) {
                setUninstallComplete(false);
                setUninstallSuccess(false);
                setUninstallError(null);
                setIsInstalled(false);
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
          {(uninstallComplete && uninstallSuccess) || (!uninstallComplete && installationSuccessful) ? (
            <>
              <p className="text-green-500 font-semibold">✓</p>
              <p className="text-green-500 font-semibold">
                {uninstallComplete
                  ? 'TAK Server Uninstallation Completed Successfully'
                  : 'TAK Server Installation Completed Successfully'
                }
              </p>
              <p className="text-sm text-gray-300">
                {uninstallComplete
                  ? 'TAK Server has been completely removed from your system.'
                  : 'You can now start using your TAK Server and configure additional features.'
                }
              </p>
            </>
          ) : (
            <>
              <p className="text-red-500 font-semibold">✗</p>
              <p className="text-red-500 text-sm font-semibold">
                {uninstallComplete
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