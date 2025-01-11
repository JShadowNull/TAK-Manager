import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/shared/ui/shadcn/dialog';
import { Progress } from '../components/shared/ui/shadcn/progress';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import ZipNameSection from '../components/datapackage/ZipNameSection/ZipNameSection';
import CotStreamsSection from '../components/datapackage/CotStreamsSection/CotStreamsSection';
import AtakPreferencesSection from '../components/datapackage/AtakPreferencesSection/AtakPreferencesSection';
import { Button } from '../components/shared/ui/shadcn/button';
import axios from 'axios';

function DataPackage() {
  const location = useLocation();
  const terminalRef = useRef(null);
  
  // State management
  const [preferences, setPreferences] = useState({});
  const [zipFileName, setZipFileName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [validationMessages, setValidationMessages] = useState([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [operationStatus, setOperationStatus] = useState({
    isInProgress: false,
    isComplete: false,
    isSuccess: false,
    errorMessage: null
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

  // Clear terminal output
  const clearTerminal = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  // Generate data package
  const handleGenerateDataPackage = useCallback(async () => {
    if (!isFormValid) {
      return;
    }

    clearTerminal();
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

      await axios({
        method: 'post',
        url: '/datapackage/submit-preferences',
        data: formattedPreferences,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
    } catch (error) {
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

  // Handle stop operation
  const handleStopOperation = async () => {
    try {
      await axios.post('/datapackage/stop');
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: false,
        errorMessage: "Operation cancelled by user"
      });
    } catch (error) {
      console.error('Error stopping operation:', error);
    }
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
          <ScrollArea>
            <CotStreamsSection
              preferences={memoizedPreferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
            />
          </ScrollArea>
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
          <ScrollArea>
            <AtakPreferencesSection
              preferences={memoizedPreferences}
              onPreferenceChange={handlePreferenceChange}
              onEnableChange={handlePreferenceEnable}
              onValidationChange={handleValidationChange}
            />
          </ScrollArea>
        </div>
      </div>

      {/* Generate Button with validation messages */}
      <div className="flex justify-center mt-4">
        <Button
          variant="primary"
          onClick={handleGenerateDataPackage}
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

      {/* Progress Dialog */}
      <Dialog 
        open={showPopup} 
        onOpenChange={operationStatus.isInProgress ? undefined : () => {
          setShowPopup(false);
          clearTerminal();
          setOperationStatus({
            isInProgress: false,
            isComplete: false,
            isSuccess: false,
            errorMessage: null
          });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isConfiguring 
                ? "Generating Data Package"
                : operationStatus.isComplete
                  ? operationStatus.isSuccess
                    ? "Data Package Complete"
                    : "Data Package Failed"
                  : "Operation Progress"}
            </DialogTitle>
            <DialogDescription>
              {operationStatus.isInProgress
                ? "Please wait while your data package is being generated..."
                : operationStatus.isComplete && operationStatus.isSuccess
                ? "Review the logs and click Next to continue."
                : operationStatus.errorMessage || "Operation in progress"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea 
              className="w-full rounded-md border p-4"
              autoScroll={true}
              content={terminalOutput}
            >
              <div className="font-mono text-sm">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            {operationStatus.isComplete && operationStatus.isSuccess && (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
            {operationStatus.isInProgress && (
              <Button variant="destructive" onClick={handleStopOperation}>
                Stop
              </Button>
            )}
            {operationStatus.errorMessage && (
              <Button onClick={() => setShowPopup(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={showCompletionPopup} onOpenChange={handleComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data Package Complete</DialogTitle>
            <DialogDescription>
              Your data package has been created and is ready to use in ATAK.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-green-500 font-semibold text-xl">✓</p>
            <p className="text-green-500 font-semibold">Data Package Generated Successfully</p>
          </div>
          <DialogFooter>
            <Button onClick={handleComplete}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DataPackage; 