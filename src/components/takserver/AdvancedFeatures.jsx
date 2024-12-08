import React, { useState, useRef, useEffect } from 'react';
import Popup from '../Popup';
import { io } from 'socket.io-client';

function AdvancedFeatures() {
  const [showOtaForm, setShowOtaForm] = useState(false);
  const [showUpdatePluginsForm, setShowUpdatePluginsForm] = useState(false);
  const [showOtaProgress, setShowOtaProgress] = useState(false);
  const [otaFormData, setOtaFormData] = useState({
    ota_zip_file: null,
  });
  const [updatePluginsFormData, setUpdatePluginsFormData] = useState({
    ota_zip_file: null,
  });
  const [terminalOutput, setTerminalOutput] = useState([]);
  const terminalRef = useRef(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationSuccessful, setInstallationSuccessful] = useState(false);
  const [installationError, setInstallationError] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [installationFailed, setInstallationFailed] = useState(false);
  const socketRef = useRef(null);
  const [completedOperation, setCompletedOperation] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('/ota-update', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Socket event listeners
    socketRef.current.on('connect', () => {
      console.log('Connected to OTA update namespace');
      setTerminalOutput(prev => [...prev, 'Connected to server']);
    });

    socketRef.current.on('ota_status', (data) => {
      setIsInstalling(data.isUpdating);
      if (data.isUpdating) {
        setTerminalOutput(prev => [...prev, 'OTA update in progress...']);
      }
    });

    socketRef.current.on('terminal_output', (data) => {
      setTerminalOutput(prev => [...prev, data.data]);
      if (terminalRef.current) {
        terminalRef.current.scrollToBottom();
      }
    });

    // Initial OTA configuration events
    socketRef.current.on('installation_started', () => {
      setTerminalOutput([]);
      setIsInstalling(true);
      setInstallationSuccessful(false);
      setInstallationError(null);
      setShowNextButton(false);
      setInstallationFailed(false);
    });

    socketRef.current.on('installation_complete', (data) => {
      if (data.status === 'success') {
        setInstallationSuccessful(true);
        setTerminalOutput(prev => [...prev, 'OTA configuration completed successfully']);
        setShowNextButton(true);
        setCompletedOperation('config');
      }
      setIsInstalling(false);
    });

    // Plugin update events
    socketRef.current.on('ota_update_started', () => {
      setTerminalOutput([]);
      setIsInstalling(true);
      setInstallationSuccessful(false);
      setInstallationError(null);
      setShowNextButton(false);
      setInstallationFailed(false);
    });

    socketRef.current.on('ota_update_complete', (data) => {
      if (data.status === 'success') {
        setInstallationSuccessful(true);
        setTerminalOutput(prev => [...prev, 'Plugin update completed successfully']);
        setShowNextButton(true);
        setCompletedOperation('update');
      }
      setIsInstalling(false);
    });

    socketRef.current.on('ota_update_failed', (data) => {
      setInstallationError(data.error);
      setInstallationFailed(true);
      setIsInstalling(false);
      setTerminalOutput(prev => [...prev, `Error: ${data.error}`]);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('terminal_output');
        socketRef.current.off('ota_status');
        socketRef.current.off('installation_started');
        socketRef.current.off('installation_complete');
        socketRef.current.off('ota_update_started');
        socketRef.current.off('ota_update_complete');
        socketRef.current.off('ota_update_failed');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleOtaInputChange = (e) => {
    const { id, files } = e.target;
    setOtaFormData(prev => ({
      ...prev,
      [id]: files[0]
    }));
  };

  const handleOtaClose = () => {
    setShowOtaForm(false);
    setOtaFormData({
      ota_zip_file: null,
    });
  };

  const handleOtaSubmit = async () => {
    try {
      // Validate file first
      if (!otaFormData.ota_zip_file || !otaFormData.ota_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid OTA plugins ZIP file');
      }

      // Clear previous states
      setTerminalOutput([]);
      setShowOtaProgress(true);
      setShowOtaForm(false);
      setIsInstalling(true);
      setInstallationSuccessful(false);
      setInstallationError(null);
      setShowNextButton(false);
      setInstallationFailed(false);

      const formDataToSend = new FormData();
      formDataToSend.append('ota_zip_file', otaFormData.ota_zip_file);

      const response = await fetch('/api/ota/start-ota-update', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Configuration failed');
      }

      const data = await response.json();
      setTerminalOutput(prev => [...prev, `Configuration started: ${data.message}`]);

    } catch (error) {
      console.error('OTA configuration error:', error);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
      setIsInstalling(false);
      setInstallationError(error.message);
      setInstallationFailed(true);
    }
  };

  const handleUpdatePluginsInputChange = (e) => {
    const { id, files } = e.target;
    setUpdatePluginsFormData(prev => ({
      ...prev,
      [id]: files[0]
    }));
  };

  const handleUpdatePluginsClose = () => {
    setShowUpdatePluginsForm(false);
    setUpdatePluginsFormData({
      ota_zip_file: null,
    });
  };

  const handleUpdatePluginsSubmit = async () => {
    try {
      // Validate file first
      if (!updatePluginsFormData.ota_zip_file || !updatePluginsFormData.ota_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid plugins ZIP file');
      }

      // Clear previous states
      setTerminalOutput([]);
      setShowOtaProgress(true);
      setShowUpdatePluginsForm(false);
      setIsInstalling(true);
      setInstallationSuccessful(false);
      setInstallationError(null);
      setShowNextButton(false);
      setInstallationFailed(false);

      const formDataToSend = new FormData();
      formDataToSend.append('ota_zip_file', updatePluginsFormData.ota_zip_file);

      const response = await fetch('/api/ota/update-ota', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }

      const data = await response.json();
      setTerminalOutput(prev => [...prev, `Update started: ${data.message}`]);

    } catch (error) {
      console.error('Plugin update error:', error);
      setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
      setIsInstalling(false);
      setInstallationError(error.message);
      setInstallationFailed(true);
    }
  };

  const handleNext = () => {
    setShowOtaProgress(false);
    setShowCompletionPopup(true);
  };

  const handleComplete = () => {
    setShowCompletionPopup(false);
    setShowOtaProgress(false);
    setTerminalOutput([]);
    setIsInstalling(false);
    setInstallationSuccessful(false);
    setInstallationError(null);
    setShowNextButton(false);
    handleOtaClose();
  };

  return (
    <>
      <div className="w-full border border-accentBoarder bg-cardBg p-4 rounded-lg">
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-bold">Advanced Features</h3>

          <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <p className="text-sm text-white">Once configured, use https://your-ip-address:8443/ota/plugins in ATAK for update url to check for plugins and install them</p>
          </div>

          <div className="flex gap-4">
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={() => setShowOtaForm(true)}
            >
              Configure OTA Updates
            </button>
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={() => setShowUpdatePluginsForm(true)}
            >
              Update Plugins
            </button>
          </div>
        </div>
      </div>

      {/* OTA Configuration Form */}
      {showOtaForm && (
        <div className="w-full border border-accentBoarder bg-cardBg p-6 rounded-lg">
          <h3 className="text-base font-bold mb-4">OTA Updates Configuration</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                OTA (Over-The-Air) updates enable ATAK users to easily discover and install available plugins and ATAK versions directly from their devices. 
                This feature streamlines the distribution of updates and new capabilities to your ATAK users without requiring manual installation. Download the plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="text-white hover:text-textSecondary">TAK.gov</a> and upload it here.
              </p>
            </div>

            {/* OTA Configuration Summary */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Configuration Summary</h4>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                <li>This will configure OTA (Over-The-Air) updates for ATAK clients</li>
                <li>The process will update the Dockerfile and docker-compose configuration</li>
                <li>TAK Server containers will be rebuilt and restarted</li>
                <li>Existing plugins folder will be removed and replaced with the new content</li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm text-yellow-400 mb-2">
              All fields are required
            </div>

            {/* File Upload Section */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-textPrimary">
                Plugins ZIP File <span className="text-red-500">*</span>
                <p className="text-sm text-textSecondary">Example: ATAK-MIL_5.2.0_loadout.zip</p>
              </label>
              <input
                type="file"
                id="ota_zip_file"
                onChange={handleOtaInputChange}
                className="w-full text-sm p-2 rounded-lg bg-inputBg border border-inputBorder focus:border-accentBorder focus:outline-none"
                accept=".zip"
                required
              />
            </div>

            <div className="flex justify-end gap-4 mt-4">
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={handleOtaClose}
              >
                Cancel
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleOtaSubmit}
              >
                Begin Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Plugins Form */}
      {showUpdatePluginsForm && (
        <div className="w-full border border-accentBoarder bg-cardBg p-6 rounded-lg">
          <h3 className="text-base font-bold mb-4">Update TAK Server Plugins</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                Update the plugins available through OTA updates on your TAK Server. This allows you to add new plugins or update existing ones
                that will be available to your ATAK users.
              </p>
            </div>

            {/* Update Summary */}
            <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Update Summary</h4>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                <li>This will update the available plugins for OTA updates</li>
                <li>Existing plugins folder will be removed and replaced with the new content</li>
                <li>TAK Server will be restarted to apply the changes</li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm text-yellow-400 mb-2">
              All fields are required
            </div>

            {/* File Upload Section */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-textPrimary">
                Plugins ZIP File <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-textSecondary">Example: ATAK-MIL_5.2.0_loadout.zip</p>
              <input
                type="file"
                id="ota_zip_file"
                onChange={handleUpdatePluginsInputChange}
                className="w-full text-sm p-2 rounded-lg bg-inputBg border border-inputBorder focus:border-accentBorder focus:outline-none"
                accept=".zip"
                required
              />
            </div>

            <div className="flex justify-end gap-4 mt-4">
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={handleUpdatePluginsClose}
              >
                Cancel
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleUpdatePluginsSubmit}
              >
                Begin Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Installation Progress Popup */}
      <Popup
        id="progress-popup"
        isVisible={showOtaProgress}
        title={
          isInstalling 
            ? completedOperation === 'config'
              ? "OTA Plugins Configuration Progress"
              : "Plugin Update Progress"
            : installationSuccessful || installationError
              ? completedOperation === 'config'
                ? "Configuration Complete"
                : "Update Complete"
              : "Operation Progress"
        }
        variant="terminal"
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        showTerminal={true}
        isInProgress={isInstalling}
        isComplete={!isInstalling && (installationSuccessful || installationError)}
        isSuccess={installationSuccessful}
        errorMessage={installationError}
        progressMessage={
          isInstalling 
            ? completedOperation === 'config'
              ? 'Configuring OTA Plugins...'
              : 'Updating Plugins...'
            : 'Operation in Progress'
        }
        nextStepMessage={
          installationSuccessful && showNextButton
            ? "Click 'Next' to proceed"
            : ''
        }
        failureMessage={
          installationError
            ? completedOperation === 'config'
              ? 'OTA Plugins configuration failed'
              : 'Plugin update failed'
            : 'Operation failed'
        }
        onClose={handleComplete}
        onNext={handleNext}
        blurSidebar={true}
      />

      {/* Configuration Completion Popup */}
      <Popup
        id="completion-popup"
        title={completedOperation === 'config' ? "Configuration Complete" : "Update Complete"}
        isVisible={showCompletionPopup && !showOtaProgress}
        variant="standard"
        onClose={handleComplete}
        blurSidebar={true}
        buttons={
          <button
            className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            onClick={handleComplete}
          >
            Close
          </button>
        }
      >
        <div className="text-center">
          <p className="text-green-500 font-semibold">✓</p>
          {completedOperation === 'config' ? (
            <>
              <p className="text-green-500 font-semibold">OTA Plugins Configuration Completed Successfully</p>
              <p className="text-sm text-gray-300">
                Your TAK Server is now configured to provide OTA updates to ATAK clients.
              </p>
            </>
          ) : (
            <>
              <p className="text-green-500 font-semibold">Plugin Update Completed Successfully</p>
              <p className="text-sm text-gray-300">
                Your TAK Server plugins have been updated and are now available in ATAK.
              </p>
            </>
          )}
        </div>
      </Popup>
    </>
  );
}

export default AdvancedFeatures; 