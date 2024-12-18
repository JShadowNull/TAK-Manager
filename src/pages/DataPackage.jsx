import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import useSocket from '../components/shared/hooks/useSocket';
import Popup from '../components/shared/ui/popups/Popup';
import CustomScrollbar from '../components/shared/ui/CustomScrollbar';
import ZipNameSection from '../components/datapackage/ZipNameSection/ZipNameSection';
import CotStreamsSection from '../components/datapackage/CotStreamsSection/CotStreamsSection';
import AtakPreferencesSection from '../components/datapackage/AtakPreferencesSection/AtakPreferencesSection';
import Button from '../components/shared/ui/Button';
import axios from 'axios';

function DataPackage() {
  const location = useLocation();
  const renderCount = useRef(0);
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  
  // State management
  const [preferences, setPreferences] = useState({});
  const [zipFileName, setZipFileName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [validationMessages, setValidationMessages] = useState([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [operationStatus, setOperationStatus] = useState({
    isInProgress: false,
    isComplete: false,
    isSuccess: false,
    errorMessage: null
  });

  // Socket event handlers
  const socketEventHandlers = {
    handleTerminalOutput: true,
    terminal_output: (data, { appendToTerminal }) => {
      const outputText = typeof data === 'string' 
        ? data 
        : (data?.data || data?.message || JSON.stringify(data));
      
      if (outputText) {
        appendToTerminal(outputText);
      }
    },
    operation_started: () => {
      setOperationStatus({
        isInProgress: true,
        isComplete: false,
        isSuccess: false,
        errorMessage: null
      });
    },
    operation_complete: (data) => {
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: true,
        errorMessage: null
      });
      setIsConfiguring(false);
    },
    operation_failed: (data) => {
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: false,
        errorMessage: data.error || 'Operation failed'
      });
      setIsConfiguring(false);
    }
  };

  // Initialize socket with useSocket hook
  const {
    isConnected: socketConnected,
    error: socketError,
    emit,
    terminalOutput,
    clearTerminal,
    socket
  } = useSocket('/data-package', {
    eventHandlers: {
      ...socketEventHandlers,
      onConnect: (socket) => {
        console.log('DataPackage: Socket connected');
      }
    },
    socketRef
  });

  // Store socket reference and log connection status
  useEffect(() => {
    if (socket) {
      console.log('Socket reference updated');
      socketRef.current = socket;
    }
  }, [socket]);

  useEffect(() => {
    console.log('Socket connected status:', socketConnected);
  }, [socketConnected]);

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

  // Memoize preferences to prevent unnecessary re-renders
  const memoizedPreferences = useMemo(() => preferences, [preferences]);

  // Enhanced validation handling with memoized dependencies
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
    console.log('handleGenerateDataPackage called');
    console.log('Form valid:', isFormValid);
    
    if (!isFormValid) {
      console.log('Form is not valid, returning early');
      return;
    }

    // Clear terminal output before starting
    clearTerminal();
    console.log('Terminal output cleared');

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

      console.log('Submitting preferences:', formattedPreferences);
      
      try {
        // Make the HTTP request
        console.log('Making HTTP request to /datapackage/submit-preferences');
        console.log('Request config:', {
          method: 'post',
          url: '/datapackage/submit-preferences',
          headers: { 'Content-Type': 'application/json' },
          data: formattedPreferences
        });

        const response = await axios({
          method: 'post',
          url: '/datapackage/submit-preferences',
          data: formattedPreferences,
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          console.error('Axios error:', {
            message: error.message,
            config: error.config,
            response: error.response,
            request: error.request
          });
          throw error;
        });
        
        console.log('Received response:', response);

        if (response.data.error) {
          throw new Error(response.data.error);
        }

        // Update operation status on success
        setOperationStatus({
          isInProgress: false,
          isComplete: true,
          isSuccess: true,
          errorMessage: null
        });
        
      } catch (error) {
        console.error('HTTP Error:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: error.config
        });
        
        throw error;  // Re-throw to be caught by outer catch block
      }

    } catch (error) {
      console.error('Error generating data package:', error);
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: false,
        errorMessage: error.message || 'Failed to generate data package'
      });
      setIsConfiguring(false);
    }
  }, [isFormValid, zipFileName, preferences, clearTerminal]);

  // Handle next step after successful operation
  const handleNext = () => {
    setShowPopup(false);
    setShowCompletionPopup(true);
  };

  // Handle completion popup close
  const handleComplete = () => {
    setShowCompletionPopup(false);
    clearTerminal();
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
      <div className="rounded-lg border border-border">
        <ZipNameSection 
          zipName={zipFileName}
          onZipNameChange={setZipFileName}
        />
      </div>

      {/* CoT Streams Section */}
      <div className="h-[400px] overflow-x-hidden relative border border-border rounded-lg">
        <div className="absolute inset-x-0 top-0 z-20 bg-backgroundPrimary">
          <div className="p-4 flex justify-between items-center">
            <div className="text-base text-medium">CoT Streams</div>
            <div className="space-x-2">
              <Button 
                variant="secondary"
                onClick={() => document.querySelector('.cot-streams-select-all')?.click()}
                tooltip="Enable all COT streams"
                tooltipStyle="shadcn"
                tooltipDelay={1000}
                tooltipPosition="bottom"
              >
                Select All
              </Button>
              <Button 
                variant="secondary"
                onClick={() => document.querySelector('.cot-streams-unselect-all')?.click()}
                tooltip="Disable all COT streams"
                tooltipStyle="shadcn"
                tooltipDelay={1000}
                tooltipPosition="bottom"
              >
                Unselect All
              </Button>
            </div>
          </div>
        </div>
        <div className="h-full pt-16">
          <CustomScrollbar>
            <CotStreamsSection
              preferences={memoizedPreferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
              socket={socket}
              isConnected={socketConnected}
            />
          </CustomScrollbar>
        </div>
      </div>

      {/* ATAK Preferences Section */}
      <div className="h-[400px] overflow-x-hidden relative border border-border rounded-lg">
        <div className="absolute inset-x-0 top-0 z-20 bg-backgroundPrimary">
          <div className="p-4 flex justify-between items-center">
            <div className="text-base text-medium">ATAK Preferences</div>
            <div className="space-x-2">
              <Button 
                variant="secondary"
                onClick={() => document.querySelector('.atak-prefs-select-all')?.click()}
                tooltip="Enable all ATAK preferences"
                tooltipStyle="shadcn"
                tooltipDelay={1000}
                tooltipPosition="bottom"
              >
                Select All
              </Button>
              <Button 
                variant="secondary"
                onClick={() => document.querySelector('.atak-prefs-unselect-all')?.click()}
                tooltip="Disable all ATAK preferences"
                tooltipStyle="shadcn"
                tooltipDelay={1000}
                tooltipPosition="bottom"
              >
                Unselect All
              </Button>
            </div>
          </div>
        </div>
        <div className="h-full pt-16">
          <CustomScrollbar>
            <AtakPreferencesSection
              preferences={memoizedPreferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
            />
          </CustomScrollbar>
        </div>
      </div>

      {/* Generate Button with validation messages */}
      <div className="flex justify-center mt-4">
        <Button
          variant="primary"
          onClick={() => {
            console.log('Generate button clicked');
            handleGenerateDataPackage();
          }}
          disabled={!isFormValid}
          tooltip={!isFormValid && validationMessages.length > 0 ? (
            <div>
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
          ) : undefined}
          tooltipStyle="shadcn"
          tooltipDelay={500}
          triggerMode="hover"
        >
          Generate Data Package
        </Button>
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
        terminalOutput={terminalOutput}
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
            clearTerminal();
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
                emit('stop_operation');
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