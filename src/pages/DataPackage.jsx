import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Popup from '../components/Popup';
import CustomScrollbar from '../components/CustomScrollbar';
import ZipNameSection from '../components/datapackage/ZipNameSection/ZipNameSection';
import CotStreamsSection from '../components/datapackage/CotStreamsSection/CotStreamsSection';
import AtakPreferencesSection from '../components/datapackage/AtakPreferencesSection/AtakPreferencesSection';

function DataPackage() {
  const location = useLocation();
  const renderCount = useRef(0);
  
  // State management
  const [preferences, setPreferences] = useState({});
  const [zipFileName, setZipFileName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [validationMessages, setValidationMessages] = useState([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const terminalRef = useRef(null);

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

  // Terminal output handling
  const appendToTerminalOutput = useCallback((text) => {
    setTerminalOutput(prev => [...prev, text]);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  // Generate data package
  const handleGenerateDataPackage = useCallback(async () => {
    if (!isFormValid) return;

    setShowPopup(true);
    setIsConfiguring(true);
    
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
      appendToTerminalOutput(data.message || data.error);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate data package');
      }

      setIsConfiguring(false);
      appendToTerminalOutput('Data package generated successfully');
    } catch (error) {
      setIsConfiguring(false);
      appendToTerminalOutput(`Error: ${error.message}`);
    }
  }, [isFormValid, zipFileName, preferences, appendToTerminalOutput]);

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

      {/* Configuration Popup */}
      <Popup
        id="data-package-popup"
        title="Generating Data Package"
        isVisible={showPopup}
        showTerminal={true}
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        onClose={() => setShowPopup(false)}
        buttons={
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:bg-red-500 transition-colors"
            onClick={() => setShowPopup(false)}
          >
            Close
          </button>
        }
      />
    </div>
  );
}

export default DataPackage; 