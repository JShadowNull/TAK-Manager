import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Popup from '../components/Popup';
import ApplicationPreferences from '../components/ApplicationPreferences';
import CotStreams from '../components/CotStreams';
import InputField from '../components/InputField';
import CustomScrollbar from '../components/CustomScrollbar';
import { COT_STREAM_ITEMS } from '../components/CotStreams';
import { APP_PREFERENCES } from '../components/ApplicationPreferences';

function DataPackage() {
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

  // Add form validation
  const validateForm = useCallback(() => {
    let isValid = true;
    let hasCaCert = false;
    let hasClientCert = false;

    if (!zipFileName.trim()) {
      isValid = false;
    }

    Object.entries(preferences).forEach(([key, pref]) => {
      if (!pref.enabled) return;

      if (key === 'caLocation0') {
        hasCaCert = Boolean(pref.value && pref.value !== 'cert/');
      } else if (key === 'certificateLocation0') {
        hasClientCert = Boolean(pref.value && pref.value !== 'cert/');
      }

      if (!pref.value && pref.type !== 'checkbox') {
        isValid = false;
      }
    });

    if ((hasCaCert || hasClientCert) && !(hasCaCert && hasClientCert)) {
      isValid = false;
    }

    setIsFormValid(isValid);
  }, [zipFileName, preferences]);

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
    const initialPreferences = {};
    
    // Initialize CoT streams with their default values
    COT_STREAM_ITEMS.forEach(item => {
      initialPreferences[item.label] = {
        value: item.input_type === 'checkbox' ? item.checked : item.value,
        enabled: false,
        type: item.input_type,
        checked: item.input_type === 'checkbox' ? item.checked : undefined
      };
    });

    // Initialize App preferences with their default values
    APP_PREFERENCES.forEach(item => {
      initialPreferences[item.label] = {
        value: item.input_type === 'checkbox' ? item.checked : item.value,
        enabled: false,
        type: item.input_type,
        checked: item.input_type === 'checkbox' ? item.checked : undefined
      };
    });

    setPreferences(initialPreferences);
  }, []);

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

  // Add socket connection and handlers
  useEffect(() => {
    socketRef.current = io('/data-package', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      appendToTerminalOutput('Connected to server');
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
      // Handle certificate files update
      if (data.files && Array.isArray(data.files)) {
        // Update certificate options in preferences
        setPreferences(prev => {
          const newPreferences = { ...prev };
          Object.entries(newPreferences).forEach(([key, pref]) => {
            if (key.toLowerCase().includes('certificate') || key.toLowerCase().includes('ca')) {
              newPreferences[key] = {
                ...pref,
                options: data.files.map(file => ({
                  value: `cert/${file}`,
                  text: file
                }))
              };
            }
          });
          return newPreferences;
        });
      }
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // Update the preference loading effect to merge with initial preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/load-preferences');
        const data = await response.json();
        if (data.preferences) {
          setPreferences(prev => {
            const newPreferences = { ...prev };
            Object.entries(data.preferences).forEach(([key, pref]) => {
              if (newPreferences[key]) {
                newPreferences[key] = {
                  ...newPreferences[key],
                  value: pref.value || newPreferences[key].value,
                  enabled: pref.enabled || newPreferences[key].enabled
                };
              }
            });
            return newPreferences;
          });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Add form validation effect
  useEffect(() => {
    validateForm();
  }, [validateForm, preferences, zipFileName]);

  // Add save preferences effect
  useEffect(() => {
    const savePreferences = async () => {
      try {
        await fetch('/save-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences)
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    };

    savePreferences();
  }, [preferences]);

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

  // Update the preference gathering function for submission
  const gatherPreferencesData = () => {
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
  };

  // Start installation process
  const startInstallation = async () => {
    try {
      const preferencesData = gatherPreferencesData();

      if (Object.keys(preferencesData).length === 0) {
        preferencesData.default_setting = 'true';
      }

      const response = await fetch('/submit-preferences', {
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

  return (
    <div className="flex flex-col gap-8 pt-14">
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
        <CustomScrollbar className="h-[400px]">
          <div className="space-y-4 cot-streams-container">
            <CotStreams
              preferences={preferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
            />
          </div>
        </CustomScrollbar>
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
        <CustomScrollbar className="h-[400px]">
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

      {/* Configure Button */}
      <div className="flex justify-center mt-4">
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