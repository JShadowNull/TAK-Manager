import React, { useState, useRef, useEffect } from 'react';
import InputField from '../InputField';
import Popup from '../Popup';
import io from 'socket.io-client';
import AdvancedFeatures from './AdvancedFeatures';
import Configuration from './Configuration';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

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

  // Add socket connection for installation progress
  useEffect(() => {
    // Socket for installation progress
    const installerSocket = io('/takserver-installer', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Socket for status updates
    const statusSocket = io('/takserver-status', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Installation socket events
    installerSocket.on('connect', () => {
      setTerminalOutput(prev => [...prev, '✓ Connected to installation service']);
    });

    installerSocket.on('connect_error', (error) => {
      setTerminalOutput(prev => [...prev, `× Connection error: ${error.message}`]);
    });

    installerSocket.on('terminal_output', (data) => {
      const logMessage = data.data;
      if (logMessage) {
        setTerminalOutput(prev => [...prev, logMessage]);
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }
    });

    // Status socket events
    statusSocket.on('takserver_status', (status) => {
      setIsInstalled(status.isInstalled);
      setIsRunning(status.isRunning);
      
      // Reset loading states when status updates
      if (!status.error) {
        setIsStarting(false);
        setIsStopping(false);
        setIsRestarting(false);
      }
      
      if (status.error) {
        setOperationError(status.error);
        setTerminalOutput(prev => [...prev, `Error: ${status.error}`]);
        // Reset loading states on error
        setIsStarting(false);
        setIsStopping(false);
        setIsRestarting(false);
      }
    });

    // Add status socket event handler for terminal output
    statusSocket.on('terminal_output', (data) => {
      const message = data.data;
      
      // Update loading states based on message content
      if (message.includes('Starting TAK Server containers...')) {
        setIsStarting(true);
        setIsStopping(false);
        setIsRestarting(false);
      } 
      else if (message.includes('Stopping TAK Server containers...')) {
        setIsStarting(false);
        setIsStopping(true);
        setIsRestarting(false);
      }
      else if (message.includes('Restarting TAK Server containers...')) {
        setIsStarting(false);
        setIsStopping(false);
        setIsRestarting(true);
      }
      // Reset states on completion or error
      else if (message.includes('successfully') || message.includes('Error')) {
        setIsStarting(false);
        setIsStopping(false);
        setIsRestarting(false);
      }

      // Add message to terminal output
      setTerminalOutput(prev => [...prev, message]);
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
    });

    installerSocket.on('installation_failed', (data) => {
      setIsInstalling(false);
      setIsStoppingInstallation(false);
      setIsRollingBack(false);
    });

    installerSocket.on('rollback_started', () => {
      setIsRollingBack(true);
    });

    installerSocket.on('rollback_complete', () => {
      setIsInstalling(false);
      setIsStoppingInstallation(false);
      setIsRollingBack(false);
    });

    // Request initial status on component mount
    statusSocket.emit('check_status');

    return () => {
      installerSocket.disconnect();
      statusSocket.disconnect();
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
        // Disable the stop button immediately
        setIsStoppingInstallation(true);
        
        // Add status message
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

      } catch (error) {
        console.error('Error stopping installation:', error);
        setTerminalOutput(prev => [...prev, `Error stopping installation: ${error.message}`]);
      }
    }
  };

  const handleNext = () => {
    setShowInstallProgress(false);
    setShowCompletionPopup(true);
  };

  const handleStartStopClick = async () => {
    try {
      setOperationError(null);
      // Note: We don't need to set loading states here anymore
      // as they will be set by the socket events
      await handleStartStop(isRunning);
    } catch (error) {
      setOperationError(error.message);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
      // Reset loading states on error
      setIsStarting(false);
      setIsStopping(false);
    }
  };

  const handleRestartClick = async () => {
    try {
      setOperationError(null);
      // Loading state will be set by socket event
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
      // Reset loading state on error
      setIsRestarting(false);
    }
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
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CircularProgress 
                            size={16} 
                            sx={{ 
                              color: isStarting || isRestarting ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                            }} 
                          />
                        </Box>
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
                <button
                  className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder 
                    bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 
                    transition-all duration-200
                    ${(isStarting || isStopping || isRestarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleRestartClick}
                  disabled={isStarting || isStopping || isRestarting}
                >
                  {isRestarting ? (
                    <span className="text-buttonTextColor">Restarting...</span>
                  ) : (
                    'Restart'
                  )}
                </button>
                <button
                  className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder 
                    bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 
                    transition-all duration-200
                    ${(isStarting || isStopping || isRestarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleStartStopClick}
                  disabled={isStarting || isStopping || isRestarting}
                >
                  {isStarting || isStopping ? (
                    <span className="text-buttonTextColor">
                      {isStarting ? 'Starting...' : 'Stopping...'}
                    </span>
                  ) : (
                    isRunning ? 'Stop' : 'Start'
                  )}
                </button>
              </>
            ) : (
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => setShowInstallForm(true)}
              >
                Install TAK Server
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Installation Form - only show if not installed */}
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
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleInstall}
              >
                Begin Installation
              </button>
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

      {/* Installation Progress Popup */}
      <Popup
        id="install-progress-popup"
        title="TAK Server Installation Progress"
        isVisible={showInstallProgress}
        showTerminal={true}
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        onClose={() => {
          if (!isInstalling && !isRollingBack) {
            setShowInstallProgress(false);
          }
        }}
        buttons={
          <>
            {isInstalling ? (
              <button
                className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor 
                  hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200
                  ${isStoppingInstallation ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleCancelInstallation}
                disabled={isStoppingInstallation}
              >
                {isStoppingInstallation ? 'Stopping...' : 'Stop Installation'}
              </button>
            ) : !isInstalling && !isRollingBack && !isStoppingInstallation && installationSuccessful ? (
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleNext}
              >
                Next
              </button>
            ) : !isRollingBack && !isInstalling && !isStoppingInstallation ? (
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={() => setShowInstallProgress(false)}
              >
                Close
              </button>
            ) : null}
          </>
        }
      >
        <div className="text-center mb-4">
          <p>
            {isRollingBack 
              ? 'Rolling Back Installation...'
              : isStoppingInstallation 
                ? 'Stopping Installation...' 
                : isInstalling 
                  ? 'Installing TAK Server...' 
                  : 'Installation Complete'}
          </p>
          {isInstalling && !isStoppingInstallation && !isRollingBack && (
            <p className="text-sm text-yellow-400">This process may take several minutes.</p>
          )}
        </div>
      </Popup>

      {/* Completion Popup */}
      <Popup
        id="completion-popup"
        title="Installation Complete"
        isVisible={showCompletionPopup}
        onClose={() => {
          setShowCompletionPopup(false);
          handleClose();
        }}
        buttons={
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            onClick={() => {
              setShowCompletionPopup(false);
              handleClose();
            }}
          >
            Close
          </button>
        }
      >
        <div className="text-center">
          <p className="text-green-500 font-semibold mb-2">✓ TAK Server Installation Completed Successfully</p>
          <p className="text-sm text-gray-300">
            You can now start using your TAK Server and configure additional features.
          </p>
        </div>
      </Popup>
    </>
  );
}

export default TakServerStatus; 