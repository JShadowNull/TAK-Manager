import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Popup from '../components/Popup';
import ApplicationPreferences from '../components/ApplicationPreferences';
import CotStreams from '../components/CotStreams';
import InputField from '../components/InputField';
import CustomScrollbar from '../components/CustomScrollbar';
import { COT_STREAM_ITEMS } from '../components/CotStreams';
import { APP_PREFERENCES } from '../components/ApplicationPreferences';

function DataPackage() {
  const navigate = useNavigate();
  // State management
  const [preferences, setPreferences] = useState({});
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [stopButtonClicked, setStopButtonClicked] = useState(false);
  const [configurationId, setConfigurationId] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [zipFileName, setZipFileName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  // Add new state for search and preferences
  const [searchTerm, setSearchTerm] = useState('');
  const [cotStreams, setCotStreams] = useState([]);
  const [appPreferences, setAppPreferences] = useState([]);

  const terminalRef = useRef(null);
  const socketRef = useRef(null);

  // Add Docker and TAK server status states
  const [dockerStatus, setDockerStatus] = useState({
    isInstalled: false,
    isRunning: false,
    error: null
  });
  const [takServerStatus, setTakServerStatus] = useState({
    isInstalled: false,
    isRunning: false,
    error: null
  });
  const [showStatusCheck, setShowStatusCheck] = useState(true);
  const [isStartingDocker, setIsStartingDocker] = useState(false);
  const [checkStep, setCheckStep] = useState('docker-install'); // docker-install, docker-running, tak-install, tak-running
  const dockerManagerSocketRef = useRef(null);
  const dockerStatusSocketRef = useRef(null);
  const takStatusSocketRef = useRef(null);
  const dataPackageSocketRef = useRef(null);

  // Add form validation
  const validateForm = useCallback(() => {
    let isValid = true;
    const streamValidation = {};
    const streamCount = parseInt(preferences.count?.value || "1", 10);
    const validationMessages = [];

    if (!zipFileName.trim()) {
      isValid = false;
      validationMessages.push("Zip file name is required");
    }

    // Initialize validation state for each stream
    for (let i = 0; i < streamCount; i++) {
      streamValidation[i] = {
        hasCaCert: false,
        hasClientCert: false,
        isEnabled: false,
        hasRequiredFields: true
      };
    }

    // First pass: collect all stream information
    Object.entries(preferences).forEach(([key, pref]) => {
      for (let i = 0; i < streamCount; i++) {
        // Check enabled state
        if (key === `description${i}` && pref.enabled) {
          streamValidation[i].isEnabled = true;
        }

        // Check certificates
        if (key === `caLocation${i}`) {
          const hasCert = Boolean(pref.value && pref.value !== 'cert/' && pref.value !== '');
          streamValidation[i].hasCaCert = hasCert;
          console.log(`Stream ${i} CA cert:`, pref.value, 'isValid:', hasCert);
        }
        if (key === `certificateLocation${i}`) {
          const hasCert = Boolean(pref.value && pref.value !== 'cert/' && pref.value !== '');
          streamValidation[i].hasClientCert = hasCert;
          console.log(`Stream ${i} Client cert:`, pref.value, 'isValid:', hasCert);
        }

        // Check required fields if enabled
        if (streamValidation[i].isEnabled) {
          if (key === `description${i}` && (!pref.value || pref.value.trim() === '')) {
            streamValidation[i].hasRequiredFields = false;
          }
          if (key === `connectString${i}` && (!pref.value || pref.value.trim() === '')) {
            streamValidation[i].hasRequiredFields = false;
          }
        }
      }
    });

    console.log('Stream validation state:', streamValidation);

    // Validate each stream
    Object.entries(streamValidation).forEach(([streamIndex, validation]) => {
      if (!validation.isEnabled) {
        console.log(`Stream ${streamIndex} is not enabled, skipping validation`);
        return;
      }

      const streamNum = parseInt(streamIndex) + 1;
      console.log(`Validating Stream ${streamNum}:`, validation);
      
      // Check required fields
      if (!validation.hasRequiredFields) {
        isValid = false;
        validationMessages.push(`Stream ${streamNum} has empty required fields`);
      }

      // For enabled streams, both certificates must be present or neither
      if (validation.hasCaCert !== validation.hasClientCert) {
        isValid = false;
        validationMessages.push(`Stream ${streamNum} requires both CA and client certificates`);
      }
    });

    console.log('Final validation state:', {
      isValid,
      messages: validationMessages,
      streamValidation
    });

    setIsFormValid(isValid);
    return validationMessages;
  }, [zipFileName, preferences]);

  // Add form validation effect
  const [validationMessages, setValidationMessages] = useState([]);
  useEffect(() => {
    const messages = validateForm();
    setValidationMessages(messages);
  }, [validateForm, preferences, zipFileName]);

  // Add preference management
  const handlePreferenceChange = useCallback((label, value) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        value: value
      }
    }));
  }, []);

  const handlePreferenceEnable = useCallback((label, enabled) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        enabled: enabled
      }
    }));
  }, []);

  // Initialize preferences with all possible items
  useEffect(() => {
    const initializePreferences = async () => {
      // First set up initial preferences
      const initialPreferences = {};
      
      // Initialize CoT streams with their default values
      COT_STREAM_ITEMS.forEach(item => {
        initialPreferences[item.label] = {
          value: item.input_type === 'checkbox' ? item.checked : item.value,
          enabled: false,
          type: item.input_type,
          checked: item.input_type === 'checkbox' ? item.checked : undefined,
          options: item.options || []
        };
      });

      // Initialize App preferences with their default values
      APP_PREFERENCES.forEach(item => {
        initialPreferences[item.label] = {
          value: item.input_type === 'checkbox' ? item.checked : item.value,
          enabled: false,
          type: item.input_type,
          checked: item.input_type === 'checkbox' ? item.checked : undefined,
          options: item.options || []
        };
      });

      try {
        // Try to load from backend
        const response = await fetch('/api/datapackage/load-preferences', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.preferences) {
          // Update initialPreferences with saved preferences
          Object.entries(data.preferences).forEach(([key, pref]) => {
            if (initialPreferences[key]) {
              initialPreferences[key] = {
                ...initialPreferences[key],
                value: pref.value !== undefined ? pref.value : initialPreferences[key].value,
                enabled: pref.enabled !== undefined ? pref.enabled : initialPreferences[key].enabled,
                checked: pref.value !== undefined && initialPreferences[key].type === 'checkbox' ? pref.value : initialPreferences[key].checked
              };
            }
          });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }

      // Set preferences after all updates
      setPreferences(initialPreferences);

      // Request certificate files after preferences are loaded
      if (socketRef.current) {
        socketRef.current.emit('get_certificate_files');
      }
    };

    initializePreferences();
  }, []);

  // Add auto-save effect for preferences
  useEffect(() => {
    const savePreferences = async () => {
      try {
        const response = await fetch('/api/datapackage/save-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ preferences })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    };

    // Save preferences whenever they change
    savePreferences();
  }, [preferences]);

  // Add socket connection and handlers
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('/data-package', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Socket event handlers
    socketRef.current.on('connect', () => {
      console.log('Connected to data-package namespace');
      appendToTerminalOutput('Connected to server');
      console.log('Requesting certificate files...');
      socketRef.current.emit('get_certificate_files');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from data-package namespace');
      appendToTerminalOutput('Disconnected from server');
    });

    socketRef.current.on('terminal_output', (data) => {
      appendToTerminalOutput(data.data);
    });

    socketRef.current.on('installation_complete', () => {
      handleCompletion('success');
    });

    socketRef.current.on('installation_failed', () => {
      handleCompletion('failure');
    });

    socketRef.current.on('certificate_files', (data) => {
      console.log('Received certificate files:', data);
      if (data.files && Array.isArray(data.files)) {
        // Format the certificate options
        const certOptions = data.files.map(file => ({
          value: `cert/${file}`,
          text: file
        }));
        console.log('Formatted certificate options:', certOptions);

        // Update preferences with certificate options
        setPreferences(prev => {
          const newPreferences = { ...prev };
          
          // Find all certificate-related preferences
          const certKeys = Object.keys(newPreferences).filter(key => 
            key.toLowerCase().includes('certificate') || 
            key.toLowerCase().includes('ca')
          );
          
          // Update each certificate preference
          certKeys.forEach(key => {
            console.log(`Updating preference ${key} with options`);
            if (newPreferences[key]) {
              newPreferences[key] = {
                ...newPreferences[key],
                type: 'select', // Ensure type is set to select
                options: certOptions,
                // Keep existing value if valid, otherwise reset
                value: certOptions.some(opt => opt.value === newPreferences[key].value) 
                  ? newPreferences[key].value 
                  : ''
              };
            }
          });

          console.log('Updated preferences:', newPreferences);
          return newPreferences;
        });
      }
    });

    socketRef.current.on('certificate_files_error', (data) => {
      console.error('Error getting certificate files:', data.error);
      appendToTerminalOutput(`Error getting certificate files: ${data.error}`);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Terminal output handling
  const appendToTerminalOutput = (text) => {
    setTerminalOutput(prev => [...prev, text]);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  // Handle configuration completion
  const handleCompletion = (status) => {
    setIsConfiguring(false);
    if (status === 'success') {
      appendToTerminalOutput('Configuration completed successfully.');
      setCurrentStep(2);
    } else {
      appendToTerminalOutput('Configuration failed.');
    }
  };

  // Start installation process
  const startInstallation = async () => {
    try {
      const preferencesData = gatherPreferencesData();

      if (Object.keys(preferencesData).length === 0) {
        preferencesData.default_setting = 'true';
      }

      const response = await fetch('/api/datapackage/submit-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(preferencesData)
      });

      const data = await response.json();
      appendToTerminalOutput(data.message || data.error);
      
      if (data.configuration_id) {
        setIsConfiguring(true);
        setConfigurationId(data.configuration_id);
      }
    } catch (error) {
      appendToTerminalOutput(`Error during submission: ${error.message}`);
      handleCompletion('failure');
    }
  };

  // Update the preference gathering function
  const gatherPreferencesData = useCallback(() => {
    const formattedPreferences = {};
    let foundCaCert = false;
    let foundClientCert = false;

    // Add zip file name
    if (zipFileName) {
      formattedPreferences['#zip_file_name'] = zipFileName;
    }

    Object.entries(preferences).forEach(([key, pref]) => {
      if (!pref.enabled) return;

      if (key === 'caLocation0' && pref.value && pref.value !== 'cert/') {
        foundCaCert = true;
        const filename = pref.value.split('/').pop();
        formattedPreferences['#ca_cert_name'] = filename;
        formattedPreferences[key] = filename;
      } else if (key === 'certificateLocation0' && pref.value && pref.value !== 'cert/') {
        foundClientCert = true;
        const filename = pref.value.split('/').pop();
        formattedPreferences['#client_cert_name'] = filename;
        formattedPreferences[key] = filename;
      } else {
        formattedPreferences[key] = pref.value;
      }
    });

    // Remove certificate markers if not found or invalid
    if (!foundCaCert) {
      delete formattedPreferences['#ca_cert_name'];
      delete formattedPreferences['caLocation0'];
    }
    if (!foundClientCert) {
      delete formattedPreferences['#client_cert_name'];
      delete formattedPreferences['certificateLocation0'];
    }

    return formattedPreferences;
  }, [preferences, zipFileName]);

  // Update the select/unselect all functions
  const handleSelectAll = useCallback((section) => {
    setPreferences(prev => {
      const newPreferences = { ...prev };
      const items = section === 'cot-streams' ? 
        COT_STREAM_ITEMS : 
        APP_PREFERENCES;
      
      items.forEach(item => {
        newPreferences[item.label] = {
          ...prev[item.label],  // Preserve existing values
          enabled: true,        // Only change the enabled state
          // Don't modify the value or checked state
          value: prev[item.label]?.value || item.value,
          type: item.input_type
        };
      });
      
      return newPreferences;
    });
  }, []);

  const handleUnselectAll = useCallback((section) => {
    setPreferences(prev => {
      const newPreferences = { ...prev };
      const items = section === 'cot-streams' ? 
        COT_STREAM_ITEMS : 
        APP_PREFERENCES;
      
      items.forEach(item => {
        newPreferences[item.label] = {
          ...prev[item.label],  // Preserve existing values
          enabled: false,       // Only change the enabled state
          // Don't modify the value or checked state
          value: prev[item.label]?.value || item.value,
          type: item.input_type
        };
      });
      
      return newPreferences;
    });
  }, []);

  // Function to close all sockets
  const closeAllSockets = useCallback(() => {
    if (dockerStatusSocketRef.current) {
      dockerStatusSocketRef.current.disconnect();
      dockerStatusSocketRef.current = null;
    }
    if (dockerManagerSocketRef.current) {
      dockerManagerSocketRef.current.disconnect();
      dockerManagerSocketRef.current = null;
    }
    if (takStatusSocketRef.current) {
      takStatusSocketRef.current.disconnect();
      takStatusSocketRef.current = null;
    }
    if (dataPackageSocketRef.current) {
      dataPackageSocketRef.current.disconnect();
      dataPackageSocketRef.current = null;
    }
  }, []);

  // Handle popup close
  const handlePopupClose = useCallback(() => {
    setShowStatusCheck(false);
    closeAllSockets();
  }, [closeAllSockets]);

  // Only check initial Docker status
  useEffect(() => {
    if (!showStatusCheck) return;

    dockerStatusSocketRef.current = io('/docker-status', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    dockerStatusSocketRef.current.on('connect', () => {
      console.log('Connected to Docker status service');
    });

    dockerStatusSocketRef.current.on('docker_status', (status) => {
      setDockerStatus(status);
      if (!status.isInstalled) {
        setCheckStep('docker-install');
      } else if (!status.isRunning) {
        setCheckStep('docker-running');
      } else {
        setCheckStep('tak-running');
        initializeTakStatusCheck();
      }
    });

    return () => {
      if (dockerStatusSocketRef.current) {
        dockerStatusSocketRef.current.disconnect();
        dockerStatusSocketRef.current = null;
      }
    };
  }, [showStatusCheck]);

  // Initialize TAK status check
  const initializeTakStatusCheck = useCallback(() => {
    if (takStatusSocketRef.current) {
      takStatusSocketRef.current.disconnect();
    }

    takStatusSocketRef.current = io('/takserver-status', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    takStatusSocketRef.current.on('connect', () => {
      console.log('Connected to TAK server status service');
      takStatusSocketRef.current.emit('check_status');
    });

    takStatusSocketRef.current.on('takserver_status', (status) => {
      const newStatus = {
        isInstalled: status.isInstalled,
        isRunning: status.isRunning,
        error: status.error
      };
      setTakServerStatus(newStatus);
      
      if (!status.isInstalled) {
        setCheckStep('tak-install');
      } else if (!status.isRunning) {
        setCheckStep('tak-running');
      } else {
        setShowStatusCheck(false);
        // Initialize data package socket here instead of using handlePopupClose
        if (dataPackageSocketRef.current) {
          dataPackageSocketRef.current.disconnect();
        }
        dataPackageSocketRef.current = io('/data-package', {
          transports: ['websocket'],
          path: '/socket.io'
        });

        dataPackageSocketRef.current.on('connect', () => {
          console.log('Connected to data package service');
          dataPackageSocketRef.current.emit('get_certificate_files');
        });

        dataPackageSocketRef.current.on('certificate_files', (data) => {
          if (data.files && Array.isArray(data.files)) {
            const certOptions = data.files.map(file => ({
              value: `cert/${file}`,
              text: file
            }));

            setPreferences(prev => {
              const newPreferences = { ...prev };
              const certKeys = Object.keys(newPreferences).filter(key => 
                key.toLowerCase().includes('certificate') || 
                key.toLowerCase().includes('ca')
              );
              
              certKeys.forEach(key => {
                if (newPreferences[key]) {
                  newPreferences[key] = {
                    ...newPreferences[key],
                    type: 'select',
                    options: certOptions,
                    value: certOptions.some(opt => opt.value === newPreferences[key].value) 
                      ? newPreferences[key].value 
                      : ''
                  };
                }
              });
              return newPreferences;
            });
          }
        });
      }
    });
  }, []);

  // Only start Docker when user explicitly clicks the button
  const handleStartDocker = () => {
    setIsStartingDocker(true);
    
    // Only connect to Docker manager when starting Docker
    if (!dockerManagerSocketRef.current) {
      dockerManagerSocketRef.current = io('/docker-manager', {
        transports: ['websocket'],
        path: '/socket.io'
      });

      dockerManagerSocketRef.current.on('connect', () => {
        console.log('Connected to Docker manager service');
        // Only emit start_docker after connection is established
        dockerManagerSocketRef.current.emit('start_docker');
      });

      dockerManagerSocketRef.current.on('docker_started', () => {
        setIsStartingDocker(false);
        setCheckStep('tak-running');
        initializeTakStatusCheck();
        // Disconnect Docker manager socket after Docker is started
        dockerManagerSocketRef.current.disconnect();
        dockerManagerSocketRef.current = null;
      });
    }
  };

  const handleStartTakServer = async () => {
    try {
      const response = await fetch('/api/takserver/takserver-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start TAK Server');
      }
      
      // Request updated status after starting
      if (takStatusSocketRef.current) {
        takStatusSocketRef.current.emit('check_status');
      }
    } catch (error) {
      console.error('Error starting TAK Server:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAllSockets();
    };
  }, [closeAllSockets]);

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Status Check Popup */}
      <Popup
        id="status-check-popup"
        title={
          checkStep === 'docker-install' ? "Docker Required" :
          checkStep === 'docker-running' ? "Docker Not Running" :
          checkStep === 'tak-install' ? "TAK Server Required" :
          "TAK Server Not Running"
        }
        isVisible={showStatusCheck}
        onClose={handlePopupClose}
        variant="standard"
        blurSidebar={false}
        buttons={
          checkStep === 'docker-install' ? (
            <a
              href="https://www.docker.com/products/docker-desktop/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            >
              Download Docker Desktop
            </a>
          ) : checkStep === 'docker-running' ? (
            <button
              onClick={handleStartDocker}
              disabled={isStartingDocker}
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200 flex items-center gap-2"
            >
              {isStartingDocker ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-buttonTextColor border-t-transparent"/>
                  Starting Docker...
                </>
              ) : (
                'Start Docker'
              )}
            </button>
          ) : checkStep === 'tak-install' ? (
            <button
              onClick={() => {
                setShowStatusCheck(false);
                navigate('/takserver');
              }}
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            >
              Install TAK Server
            </button>
          ) : (
            <button
              onClick={handleStartTakServer}
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            >
              Start TAK Server
            </button>
          )
        }
      >
        <div className="text-center">
          {checkStep === 'docker-install' ? (
            <>
              <p className="text-yellow-500 font-semibold">
                Docker Desktop is required
              </p>
              <p className="text-sm text-gray-300">
                TAK Server requires Docker Desktop to run. Please install Docker Desktop to continue.
              </p>
            </>
          ) : checkStep === 'docker-running' ? (
            <>
              <p className="text-yellow-500 font-semibold">
                Docker Desktop is not running
              </p>
              <p className="text-sm text-gray-300">
                Docker Desktop must be running to use TAK Server. Click the button below to start Docker.
              </p>
            </>
          ) : checkStep === 'tak-install' ? (
            <>
              <p className="text-yellow-500 font-semibold">
                TAK Server is not installed
              </p>
              <p className="text-sm text-gray-300">
                Please install TAK Server to continue.
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-500 font-semibold">
                TAK Server is not running
              </p>
              <p className="text-sm text-gray-300">
                Click the button below to start TAK Server.
              </p>
            </>
          )}
        </div>
      </Popup>

      {/* Data Package Name Section */}
      <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg w-full">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold top-0">Zip File Name</h3>
          <div className="w-1/4 justify-end pr-4">
            <InputField
              type="text"
              id="zip-file-name"
              placeholder="Enter Zip File Name without .zip extension"
              value={zipFileName}
              onChange={(e) => setZipFileName(e.target.value)}
              className="text-buttonTextColor placeholder-textSecondary"
              onBlur={validateForm}
            />
          </div>
        </div>
      </div>

      {/* CoT Streams Section */}
      <div className="border border-accentBoarder p-4 bg-cardBg rounded-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold top-0">CoT Streams</h3>
          <div className="flex gap-2">
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-green-500"
              onClick={() => handleSelectAll('cot-streams')}
            >
              Select All
            </button>
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-red-500"
              onClick={() => handleUnselectAll('cot-streams')}
            >
              Unselect All
            </button>
          </div>
        </div>
        <div className="h-[400px] overflow-x-hidden w-full">
          <CustomScrollbar>
            <div className="space-y-4 cot-streams-container w-full">
              <CotStreams
                preferences={preferences}
                onPreferenceChange={handlePreferenceChange}
                onEnableChange={handlePreferenceEnable}
              />
            </div>
          </CustomScrollbar>
        </div>
      </div>

      {/* Application Preferences Section */}
      <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg w-full">
        <div className="flex items-center justify-between mb-4">
          {/* Left - Heading */}
          <h3 className="text-base font-bold text-textPrimary whitespace-nowrap">
            Application Preferences
          </h3>
          
          {/* Center - Search Bar */}
          <div className="flex-1 flex justify-center mx-4">
            <InputField
              type="search"
              id="app-prefs-search"
              placeholder="Search preferences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Right - Buttons */}
          <div className="flex gap-2 whitespace-nowrap">
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-green-500"
              onClick={() => handleSelectAll('app-prefs')}
            >
              Select All
            </button>
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-red-500"
              onClick={() => handleUnselectAll('app-prefs')}
            >
              Unselect All
            </button>
          </div>
        </div>
        <div className="h-[400px]">
          <CustomScrollbar>
            <div className="space-y-4 app-prefs-container">
              <ApplicationPreferences
                preferences={preferences}
                searchTerm={searchTerm}
                onPreferenceChange={handlePreferenceChange}
                onEnableChange={handlePreferenceEnable}
              />
            </div>
          </CustomScrollbar>
        </div>
      </div>

      {/* Configure Button */}
      <div className="flex justify-center mt-4">
        <div className="relative group">
          <button
            id="configure-data-package-btn"
            className={`text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-green-500 ${!isFormValid ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              setShowPopup(true);
              startInstallation();
            }}
            disabled={!isFormValid}
          >
            Create Data Package
          </button>
          {!isFormValid && validationMessages.length > 0 && (
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 bg-gray-900 text-white text-sm rounded-lg p-2 shadow-lg">
              <div className="font-semibold mb-1">Please fix the following:</div>
              <ul className="list-disc pl-4">
                {validationMessages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                <div className="border-8 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popup Modal */}
      <Popup
        id="popup-configure-data-package"
        title="Create Data Package"
        isVisible={showPopup}
        showTerminal={true}
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        onClose={() => setShowPopup(false)}
        buttons={
          <>
            {isConfiguring && !stopButtonClicked && (
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-red-500"
                onClick={() => setStopButtonClicked(true)}
              >
                Stop
              </button>
            )}
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor hover:text-black hover:shadow-soft hover:border-black hover:shadow-black hover:bg-red-500"
              onClick={() => setShowPopup(false)}
            >
              Close
            </button>
          </>
        }
      >
        {/* Step 1: Terminal Output */}
        <div id="data-package-step-1" className={currentStep === 1 ? '' : 'hidden'}>
          {/* Terminal output is handled by the Popup component */}
        </div>

        {/* Step 2: Data Package Creation Success */}
        <div id="data-package-step-2" className={currentStep === 2 ? '' : 'hidden'}>
          <p className="mb-2 text-sm text-center">
            Data package creation successful! Your package is ready for use.
          </p>
        </div>
      </Popup>
    </div>
  );
}

export default DataPackage; 