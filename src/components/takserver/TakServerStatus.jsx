import React, { useState, useRef, useEffect } from 'react';
import InputField from '../InputField';
import Popup from '../shared/Popup';
import io from 'socket.io-client';
import AdvancedFeatures from './AdvancedFeatures';
import Configuration from './Configuration';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import DockerPopup from '../shared/docker/DockerPopup';
import Button from '../shared/Button';

function TakServerStatus({ handleStartStop }) {
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [showInstallProgress, setShowInstallProgress] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
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
  const dockerManagerSocketRef = useRef(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const uninstallSocketRef = useRef(null);
  const [uninstallComplete, setUninstallComplete] = useState(false);
  const [uninstallSuccess, setUninstallSuccess] = useState(false);
  const [uninstallError, setUninstallError] = useState(null);
  const [installationFailed, setInstallationFailed] = useState(false);
  const [installationError, setInstallationError] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);

  useEffect(() => {
    // Initialize Docker status socket
    const socket = io('/docker-manager', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to Docker manager socket');
    });

    socket.on('connect_error', (error) => {
      console.error('Docker manager socket connection error:', error);
      setDockerStatus(prev => ({
        ...prev,
        error: 'Failed to connect to Docker status service'
      }));
    });

    socket.on('docker_status', (status) => {
      setDockerStatus({
        isInstalled: status.isInstalled,
        isRunning: status.isRunning,
        error: status.error
      });
      if (status.isInstalled && status.isRunning) {
        connectTakServerSockets();
      }
    });

    // Initialize Docker manager socket for start functionality only
    dockerManagerSocketRef.current = io('/docker-manager', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Initialize uninstall socket
    uninstallSocketRef.current = io('/takserver-uninstall', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Uninstall socket events
    uninstallSocketRef.current.on('connect', () => {
      console.log('Connected to uninstall service');
      setTerminalOutput(['✓ Connected to uninstall service']);
    });

    uninstallSocketRef.current.on('uninstall_status', (status) => {
      setIsUninstalling(status.isUninstalling);
      if (status.message) {
        setTerminalOutput(prev => [...prev, status.message]);
      }
    });

    uninstallSocketRef.current.on('terminal_output', (data) => {
      if (data.data) {
        setTerminalOutput(prev => [...prev, data.data]);
      }
    });

    uninstallSocketRef.current.on('uninstall_complete', (result) => {
      setIsUninstalling(false);
      setUninstallComplete(true);
      if (result.success) {
        setUninstallSuccess(true);
        setTerminalOutput(prev => [...prev, 'TAK Server uninstallation completed successfully']);
      } else {
        setUninstallError(result.message);
        setTerminalOutput(prev => [...prev, `Error: ${result.message}`]);
      }
    });

    const connectTakServerSockets = () => {
      const installerSocket = io('/takserver-installer', {
        transports: ['websocket'],
        path: '/socket.io'
      });

      const statusSocket = io('/takserver-status', {
        transports: ['websocket'],
        path: '/socket.io'
      });

      // Installation socket events
      installerSocket.on('connect', () => {
        setTerminalOutput(['✓ Connected to installation service']);
      });

      installerSocket.on('connect_error', (error) => {
        setTerminalOutput([`× Connection error: ${error.message}`]);
      });

      installerSocket.on('terminal_output', (data) => {
        if (data.data) {
          setTerminalOutput(prev => [...prev, data.data]);
        }
      });

      // Status socket events
      statusSocket.on('takserver_status', (status) => {
        setIsInstalled(status.isInstalled);
        setIsRunning(status.isRunning);
        
        // Update loading states based on backend status
        setIsStarting(status.is_starting || false);
        setIsStopping(status.is_stopping || false);
        setIsRestarting(status.is_restarting || false);
        
        if (status.error) {
          setOperationError(status.error);
          // Reset loading states on error
          setIsStarting(false);
          setIsStopping(false);
          setIsRestarting(false);
        }
      });

      // Only handle terminal output from status socket if not installing
      statusSocket.on('terminal_output', (data) => {
        if (!isInstalling && data.data) {
          setTerminalOutput(prev => [...prev, data.data]);
        }
      });

      // Installation events
      installerSocket.on('installation_started', () => {
        setIsInstalling(true);
        setIsStoppingInstallation(false);
        setShowInstallProgress(true);
      });

      installerSocket.on('installation_complete', () => {
        setIsInstalling(false);
        setIsStoppingInstallation(false);
        setInstallationSuccessful(true);
        setShowNextButton(true);
      });

      installerSocket.on('installation_failed', (data) => {
        setIsInstalling(false);
        setIsStoppingInstallation(false);
        setIsRollingBack(false);
        setInstallationFailed(true);
        setInstallationError(data.message || 'Installation failed');
      });

      installerSocket.on('rollback_started', () => {
        setIsRollingBack(true);
      });

      installerSocket.on('rollback_complete', () => {
        setIsInstalling(false);
        setIsStoppingInstallation(false);
        setIsRollingBack(false);
      });

      // Request initial status
      statusSocket.emit('check_status');

      return () => {
        installerSocket.disconnect();
        statusSocket.disconnect();
      };
    };

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      if (dockerManagerSocketRef.current) {
        dockerManagerSocketRef.current.disconnect();
        dockerManagerSocketRef.current = null;
      }
      if (uninstallSocketRef.current) {
        uninstallSocketRef.current.disconnect();
      }
    };
  }, []);

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

      // Clear previous terminal output
      setTerminalOutput([]);
      setShowInstallProgress(true);

      // Append file with proper name
      formDataToSend.append('docker_zip_file', formData.docker_zip_file, formData.docker_zip_file.name);
      
      // Append other form fields
      requiredFields.forEach(field => {
        formDataToSend.append(field, formData[field]);
      });

      const response = await fetch('/api/takserver/install-takserver', {
        method: 'POST',
        body: formDataToSend,
        // Don't set Content-Type header - browser will set it with boundary
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Installation failed');
      }

      const data = await response.json();
      setInstallationId(data.installation_id);
      setTerminalOutput(prev => [...prev, `Installation started: ${data.message}`]);
      setShowInstallForm(false);

    } catch (error) {
      console.error('Installation error:', error.message);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
      setIsInstalling(false);
    }
  };

  const handleCancelInstallation = async () => {
    if (installationId && isInstalling && !isStoppingInstallation) {
      try {
        setIsStopping(true);
        setIsStoppingInstallation(true);
        setTerminalOutput(prev => [...prev, 'Stopping installation and starting rollback...']);

        const response = await fetch('/api/takserver/rollback-takserver', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ installation_id: installationId }),
        });

        if (!response.ok) {
          throw new Error('Failed to stop installation');
        }

        setInstallationFailed(true);
        setInstallationError('Installation cancelled by user');
      } catch (error) {
        console.error('Error stopping installation:', error);
        setTerminalOutput(prev => [...prev, `Error stopping installation: ${error.message}`]);
        setInstallationFailed(true);
        setInstallationError(error.message);
      }
    }
  };

  const handleNext = () => {
    if (isUninstalling || uninstallComplete) {
      setShowInstallProgress(false);
      setShowCompletionPopup(false);
      // Show the uninstall completion popup
      setUninstallComplete(true);
    } else {
      setShowInstallProgress(false);
      setShowCompletionPopup(true);
    }
  };

  const handleStartStopClick = async () => {
    try {
      setOperationError(null);
      // Don't manually set loading states here, they will come from backend
      await handleStartStop(isRunning);
    } catch (error) {
      setOperationError(error.message);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(null);
      // Don't manually set loading states here, they will come from backend
      const response = await fetch('/api/takserver/takserver-restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restart TAK Server');
      }
    } catch (error) {
      setOperationError(error.message);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
    }
  };

  const handleUninstall = () => {
    if (uninstallSocketRef.current) {
      setShowUninstallConfirm(false);
      setShowInstallProgress(true);
      setTerminalOutput(['Starting TAK Server uninstallation...']);
      setUninstallComplete(false);
      setUninstallSuccess(false);
      setUninstallError(null);
      uninstallSocketRef.current.emit('start_uninstall');
    }
  };

  const handleUninstallComplete = () => {
    setShowInstallProgress(false);
    setTerminalOutput([]);
    setUninstallComplete(false);
    setUninstallSuccess(false);
    setUninstallError(null);
    setIsUninstalling(false);
    setIsInstalled(false); // Update the installation status
  };

  const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-4 w-4 border-2 border-buttonTextColor border-t-transparent"/>
  );

  return (
    <>
      <div className="w-full border border-accentBoarder bg-cardBg p-6 rounded-lg">
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
                        <div className="flex items-center gap-2">
                          <Button
                            disabled
                            loading
                            variant="primary"
                            className={
                              isStarting ? "hover:bg-green-500" :
                              isRestarting ? "hover:bg-yellow-500" :
                              "hover:bg-red-500"
                            }
                          >
                            {isStarting ? "Starting" :
                             isRestarting ? "Restarting" :
                             "Stopping"}
                          </Button>
                        </div>
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
                  {operationError && (
                    <div className="text-sm text-red-500">
                      {operationError}
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
                      loadingText="Restarting..."
                      variant="primary"
                      className="hover:bg-yellow-500"
                    >
                      Restart
                    </Button>
                    <Button
                      onClick={handleStartStopClick}
                      disabled={isStarting || isStopping || isRestarting || isUninstalling}
                      loading={isStarting || isStopping}
                      loadingText={isStarting ? 'Starting...' : 'Stopping...'}
                      variant="primary"
                      className="hover:bg-red-500"
                    >
                      Stop
                    </Button>
                    <Button
                      asChild
                      variant="primary"
                    >
                      <a
                        href="https://localhost:8443"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Launch Admin Page
                      </a>
                    </Button>
                  </>
                )}
                {!isRunning && (
                  <Button
                    onClick={handleStartStopClick}
                    disabled={isStarting || isStopping || isRestarting || isUninstalling}
                    loading={isStarting || isStopping}
                    loadingText={isStarting ? 'Starting...' : 'Stopping...'}
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
        <div className="w-full border border-accentBoarder bg-cardBg p-6 rounded-lg">
          <h3 className="text-base font-bold mb-4">Installation Configuration</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                TAK Server is a powerful middleware solution that enables real-time situational awareness and information sharing. 
                It acts as a central hub for connecting ATAK clients, managing user authentication, and facilitating secure data exchange between team members. 
                The server provides essential features like data persistence, user management, and mission data sharing capabilities.
              </p>
            </div>

            {/* Installation Summary */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Installation Summary</h4>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                <li>This will install TAK Server and PostgreSQL database within Docker Desktop</li>
                <li>Certificate enrollment will be configured by default for client authentication</li>
                <li>All data will be stored in your Documents folder using Docker volumes</li>
                <li>For the TAK Server ZIP file, please download the Docker version from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="text-white hover:text-textSecondary">TAK.gov</a></li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm text-yellow-400 mb-2">
              All fields are required
            </div>

            {/* File Upload Section */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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
                <label className="text-sm font-semibold text-textPrimary">
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

      {/* Installation/Uninstall Progress Popup */}
      <Popup
        id="progress-popup"
        isVisible={showInstallProgress}
        title={
          isUninstalling 
            ? "TAK Server Uninstallation Progress" 
            : isInstalling 
              ? "TAK Server Installation Progress"
              : uninstallComplete
                ? "Uninstallation Complete"
                : installationSuccessful || installationFailed
                  ? "Installation Complete"
                  : "Operation Progress"
        }
        variant="terminal"
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        showTerminal={true}
        isInProgress={isInstalling || isUninstalling}
        isComplete={uninstallComplete || (!isInstalling && !isUninstalling && (installationSuccessful || installationFailed))}
        isSuccess={uninstallSuccess || installationSuccessful}
        errorMessage={uninstallError || installationError}
        progressMessage={
          isRollingBack 
            ? 'Rolling Back Installation...'
            : isStoppingInstallation 
              ? 'Stopping Installation...' 
              : isInstalling 
                ? 'Installing TAK Server...'
                : isUninstalling
                  ? 'Uninstalling TAK Server...'
                  : 'Operation in Progress'
        }
        successMessage={
          uninstallSuccess 
            ? 'TAK Server was successfully uninstalled'
            : ''
        }
        nextStepMessage={
          (!isUninstalling && installationSuccessful && showNextButton)
            ? "Click 'Next' to proceed"
            : uninstallSuccess
              ? "Click 'Next' to complete uninstallation"
              : ''
        }
        failureMessage={
          isUninstalling
            ? 'TAK Server uninstallation failed'
            : installationFailed
              ? 'TAK Server installation failed'
              : 'Operation failed'
        }
        onClose={handleUninstallComplete}
        onNext={handleNext}
        onStop={
          isInstalling 
            ? handleCancelInstallation
            : undefined
        }
        blurSidebar={true}
      />

      {/* Installation Completion Popup */}
      <Popup
        id="completion-popup"
        title="Installation Complete"
        isVisible={showCompletionPopup && !showInstallProgress && !uninstallComplete && !isUninstalling}
        variant="standard"
        onClose={() => {
          setShowCompletionPopup(false);
          handleClose();
        }}
        blurSidebar={true}
        buttons={
          <Button
            onClick={() => {
              setShowCompletionPopup(false);
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
          <p className="text-green-500 font-semibold">✓</p>
          <p className="text-green-500 font-semibold">TAK Server Installation Completed Successfully</p>
          <p className="text-sm text-gray-300">
            You can now start using your TAK Server and configure additional features.
          </p>
        </div>
      </Popup>

      {/* Uninstall Completion Popup */}
      <Popup
        id="uninstall-completion-popup"
        title="Uninstallation Complete"
        isVisible={uninstallComplete && !showInstallProgress && !showCompletionPopup}
        variant="standard"
        onClose={handleUninstallComplete}
        blurSidebar={true}
        buttons={
          <Button
            onClick={handleUninstallComplete}
            variant="primary"
            className="hover:bg-green-500"
          >
            Close
          </Button>
        }
      >
        <div className="text-center">
          {uninstallSuccess ? (
            <>
              <p className="text-green-500 font-semibold">✓</p>
              <p className="text-green-500 font-semibold">TAK Server Uninstallation Completed Successfully</p>
              <p className="text-sm text-gray-300">
                TAK Server has been completely removed from your system.
              </p>
            </>
          ) : (
            <>
              <p className="text-red-500 font-semibold">✗</p>
              <p className="text-red-500 font-semibold">TAK Server Uninstallation Failed</p>
              <p className="text-sm text-gray-300">
                {uninstallError || 'An error occurred during uninstallation.'}
              </p>
            </>
          )}
        </div>
      </Popup>
    </>
  );
}

export default TakServerStatus; 