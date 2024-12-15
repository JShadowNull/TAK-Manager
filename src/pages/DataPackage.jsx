import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import Popup from '../components/shared/Popup';
import CustomScrollbar from '../components/CustomScrollbar';
import ZipNameSection from '../components/datapackage/ZipNameSection/ZipNameSection';
import CotStreamsSection from '../components/datapackage/CotStreamsSection/CotStreamsSection';
import AtakPreferencesSection from '../components/datapackage/AtakPreferencesSection/AtakPreferencesSection';
import Button from '../components/shared/Button';

function DataPackage() {
  const location = useLocation();
  const renderCount = useRef(0);
  const socketRef = useRef(null);
  
  // State management
  const [preferences, setPreferences] = useState({});
  const [zipFileName, setZipFileName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [validationMessages, setValidationMessages] = useState([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [operationStatus, setOperationStatus] = useState({
    isInProgress: false,
    isComplete: false,
    isSuccess: false,
    errorMessage: null
  });
  const terminalRef = useRef(null);

  // Socket.IO initialization and cleanup
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('/data-package', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Connection handlers
    socketRef.current.on('connect', () => {
      console.log('Connected to data-package service');
      setSocketConnected(true);
      setSocketError(null);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocketError(err);
      setSocketConnected(false);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from data-package service');
      setSocketConnected(false);
    });

    // Terminal output handler
    socketRef.current.on('terminal_output', (data) => {
      if (data && data.data) {
        setTerminalOutput(prev => [...prev, data.data]);
      }
    });

    // Operation status handlers
    socketRef.current.on('operation_started', () => {
      console.log('Operation started');
      setOperationStatus({
        isInProgress: true,
        isComplete: false,
        isSuccess: false,
        errorMessage: null
      });
    });

    socketRef.current.on('operation_complete', (data) => {
      console.log('Operation complete:', data);
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: true,
        errorMessage: null
      });
      setIsConfiguring(false);
    });

    socketRef.current.on('operation_failed', (data) => {
      console.log('Operation failed:', data);
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: false,
        errorMessage: data.error || 'Operation failed'
      });
      setIsConfiguring(false);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection to /data-package');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Debug re-renders
  useEffect(() => {
    renderCount.current += 1;
    console.log('DataPackage: Component rendering, path:', location.pathname, 'render count:', renderCount.current);
  });

  // Common handlers for preferences - memoized to prevent unnecessary re-renders
  const handlePreferenceChange = useCallback((label, value) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        value
      }
    }));
  }, []);

  const handlePreferenceEnable = useCallback((label, enabled) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        enabled
      }
    }));
  }, []);

  // Enhanced validation handling
  const handleValidationChange = useCallback((section, errors) => {
    setValidationMessages(prevMessages => {
      const messages = [];

      // Zip file validation with more detail
      if (!zipFileName.trim()) {
        messages.push("❌ Zip File Name: Required - Please enter a name for your data package");
      } else if (zipFileName.includes('.zip')) {
        messages.push("❌ Zip File Name: Should not include .zip extension - it will be added automatically");
      }

      // Group validation messages by section
      if (section === 'cot_streams') {
        Object.entries(errors).forEach(([key, error]) => {
          const streamMatch = key.match(/(\d+)/);
          if (streamMatch) {
            const streamNumber = parseInt(streamMatch[1]) + 1;
            messages.push(`❌ Stream ${streamNumber}: ${error}`);
          }
        });
      }

      if (section === 'atak_preferences') {
        Object.entries(errors).forEach(([key, error]) => {
          messages.push(`❌ ATAK Preference: ${error}`);
        });
      }

      const isValid = messages.length === 0;
      if (isValid !== isFormValid) {
        setIsFormValid(isValid);
      }

      return messages;
    });
  }, [zipFileName, isFormValid]);

  // Generate data package
  const handleGenerateDataPackage = useCallback(async () => {
    if (!isFormValid) return;
    if (!socketConnected) {
      console.error('Socket not connected. Cannot generate data package.');
      return;
    }

    setShowPopup(true);
    setIsConfiguring(true);
    setOperationStatus({
      isInProgress: true,
      isComplete: false,
      isSuccess: false,
      errorMessage: null
    });
    
    try {
      const formattedPreferences = {};
      
      // Add zip file name
      formattedPreferences['#zip_file_name'] = zipFileName;

      // Track certificates for each stream
      const streamCertificates = {};

      // Add enabled preferences
      Object.entries(preferences).forEach(([key, pref]) => {
        if (!pref.enabled) return;

        if (key.includes('Location') && pref.value && pref.value !== 'cert/') {
          const filename = pref.value.split('/').pop();
          formattedPreferences[key] = filename;

          // Track certificate filenames for each stream
          const streamMatch = key.match(/(\d+)$/);
          if (streamMatch) {
            const streamIndex = streamMatch[1];
            if (!streamCertificates[streamIndex]) {
              streamCertificates[streamIndex] = {};
            }
            if (key.includes('caLocation')) {
              streamCertificates[streamIndex].ca = filename;
            } else if (key.includes('certificateLocation')) {
              streamCertificates[streamIndex].client = filename;
            }
          }
        } else {
          formattedPreferences[key] = pref.value;
        }
      });

      // Add certificate markers for each stream
      Object.entries(streamCertificates).forEach(([streamIndex, certs]) => {
        if (preferences[`enabled${streamIndex}`]?.value) {
          if (certs.ca) {
            formattedPreferences[`#ca_cert_name${streamIndex}`] = certs.ca;
          }
          if (certs.client) {
            formattedPreferences[`#client_cert_name${streamIndex}`] = certs.client;
          }
        }
      });

      const response = await fetch('/api/datapackage/submit-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedPreferences)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate data package');
      }

    } catch (error) {
      console.error('Error generating data package:', error);
      if (socketRef.current) {
        socketRef.current.emit('operation_failed', { error: error.message });
      }
    }
  }, [isFormValid, zipFileName, preferences, socketConnected]);

  // Handle next step after successful operation
  const handleNext = () => {
    setShowPopup(false);
    setShowCompletionPopup(true);
  };

  // Handle completion popup close
  const handleComplete = () => {
    setShowCompletionPopup(false);
    setTerminalOutput([]);
    setOperationStatus({
      isInProgress: false,
      isComplete: false,
      isSuccess: false,
      errorMessage: null
    });
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Zip Name Section */}
      <div className="rounded-lg border border-accentBoarder">
        <ZipNameSection 
          zipName={zipFileName}
          onZipNameChange={setZipFileName}
        />
      </div>

      {/* CoT Streams Section */}
      <div className="h-[400px] overflow-x-hidden relative border border-accentBoarder rounded-lg">
        <div className="absolute inset-x-0 top-0 z-20 bg-backgroundPrimary">
          <div className="p-4 flex justify-between items-center">
            <div className="text-base text-medium">CoT Streams</div>
            <div className="space-x-2">
              <button 
                onClick={() => document.querySelector('.cot-streams-select-all')?.click()}
                className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor 
                  hover:text-black hover:shadow-md hover:accentBoarder hover:bg-selectedColor
                  transition-all duration-200"
              >
                Select All
              </button>
              <button 
                onClick={() => document.querySelector('.cot-streams-unselect-all')?.click()}
                className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor 
                  hover:text-black hover:shadow-md hover:accentBoarder hover:bg-selectedColor
                  transition-all duration-200"
              >
                Unselect All
              </button>
            </div>
          </div>
        </div>
        <div className="h-full pt-16">
          <CustomScrollbar>
            <CotStreamsSection
              preferences={preferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
            />
          </CustomScrollbar>
        </div>
      </div>

      {/* ATAK Preferences Section */}
      <div className="h-[400px] overflow-x-hidden relative border border-accentBoarder rounded-lg">
        <div className="absolute inset-x-0 top-0 z-20 bg-backgroundPrimary">
          <div className="p-4 flex justify-between items-center">
            <div className="text-base text-medium">ATAK Preferences</div>
            <div className="space-x-2">
              <button 
                onClick={() => document.querySelector('.atak-prefs-select-all')?.click()}
                className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor 
                  hover:text-black hover:shadow-md hover:accentBoarder hover:bg-selectedColor
                  transition-all duration-200"
              >
                Select All
              </button>
              <button 
                onClick={() => document.querySelector('.atak-prefs-unselect-all')?.click()}
                className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor 
                  hover:text-black hover:shadow-md hover:accentBoarder hover:bg-selectedColor
                  transition-all duration-200"
              >
                Unselect All
              </button>
            </div>
          </div>
        </div>
        <div className="h-full pt-16">
          <CustomScrollbar>
            <AtakPreferencesSection
              preferences={preferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
            />
          </CustomScrollbar>
        </div>
      </div>

      {/* Generate Button with original styling but enhanced messages */}
      <div className="flex justify-center mt-4">
        <div className="relative group">
          <button
            className={`
              text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder 
              bg-buttonColor hover:text-black hover:shadow-md hover:border-black 
              hover:bg-green-500 transition-all duration-200
              ${!isFormValid ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={handleGenerateDataPackage}
            disabled={!isFormValid}
          >
            Generate Data Package
          </button>
          {!isFormValid && validationMessages.length > 0 && (
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-96 bg-gray-900 text-white text-sm rounded-lg p-2 shadow-lg">
              <div className="font-semibold mb-1">Please fix the following:</div>
              <ul className="list-disc pl-4 max-h-60 overflow-y-auto">
                {validationMessages.map((message, index) => (
                  <li 
                    key={index}
                    className={message.startsWith('❌') ? 'text-red-300' : ''}
                  >
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Popup with connection status */}
      <Popup
        id="data-package-popup"
        isVisible={showPopup}
        title={
          isConfiguring 
            ? "Generating Data Package"
            : operationStatus.isComplete
              ? operationStatus.isSuccess
                ? "Data Package Complete"
                : "Data Package Failed"
              : "Operation Progress"
        }
        variant="terminal"
        terminalOutput={[
          ...(socketError ? [`Connection Error: ${socketError.message}`] : []),
          ...(socketConnected ? [] : ['Attempting to connect to server...']),
          ...terminalOutput
        ]}
        terminalRef={terminalRef}
        showTerminal={true}
        isInProgress={operationStatus.isInProgress}
        isComplete={!operationStatus.isInProgress && (operationStatus.isComplete)}
        isSuccess={operationStatus.isSuccess}
        errorMessage={operationStatus.errorMessage}
        progressMessage={
          operationStatus.isInProgress
            ? "Generating data package configuration..."
            : 'Operation in Progress'
        }
        successMessage={
          operationStatus.isComplete && operationStatus.isSuccess
            ? "Data package generated successfully"
            : ""
        }
        nextStepMessage={
          operationStatus.isComplete && operationStatus.isSuccess
            ? "Your data package has been created successfully. Click 'Next' to continue."
            : ""
        }
        failureMessage={
          operationStatus.errorMessage
            ? 'Data package generation failed'
            : 'Operation failed'
        }
        onClose={() => {
          if (!operationStatus.isInProgress) {
            setShowPopup(false);
            setTerminalOutput([]);
            setOperationStatus({
              isInProgress: false,
              isComplete: false,
              isSuccess: false,
              errorMessage: null
            });
          }
        }}
        onNext={handleNext}
        onStop={
          operationStatus.isInProgress
            ? () => {
                if (socketRef.current) {
                  socketRef.current.emit('stop_operation');
                }
                setOperationStatus({
                  isInProgress: false,
                  isComplete: true,
                  isSuccess: false,
                  errorMessage: "Operation cancelled by user"
                });
              }
            : undefined
        }
        blurSidebar={true}
      />

      {/* Completion Popup */}
      <Popup
        id="completion-popup"
        title="Data Package Complete"
        isVisible={showCompletionPopup}
        variant="standard"
        onClose={handleComplete}
        blurSidebar={true}
        buttons={
          <Button
            variant="primary"
            onClick={handleComplete}
          >
            Close
          </Button>
        }
      >
        <div className="text-center">
          <p className="text-green-500 font-semibold">✓</p>
          <p className="text-green-500 font-semibold">Data Package Generated Successfully</p>
          <p className="text-sm text-gray-300">
            Your data package has been created and is ready to use in ATAK.
          </p>
        </div>
      </Popup>
    </div>
  );
}

export default DataPackage; 