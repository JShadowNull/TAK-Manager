import React, { useState } from 'react';
import Popup from '../shared/ui/popups/Popup';
import useSocket, { SocketNamespace } from '../shared/hooks/useSocket';
import { Button } from '../shared/ui/shadcn/button';
import { HelpIconTooltip } from '../shared/ui/shadcn/tooltip/HelpIconTooltip';
import type { Socket } from 'socket.io-client';

interface OtaFormData {
  ota_zip_file: File | null;
}

type EventHandlers = {
  [key: string]: ((data: any, helpers: {
    state: any;
    updateState: (updates: any) => void;
    appendToTerminal: (message: string) => void;
    clearTerminal: () => void;
    socket: Socket | undefined;
  }) => void) | ((socket: Socket) => void) | ((error: Error) => void) | (() => void) | boolean | undefined;
  onConnect?: (socket: Socket) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
  handleTerminalOutput?: boolean;
};

const AdvancedFeatures: React.FC = () => {
  const [showOtaForm, setShowOtaForm] = useState<boolean>(false);
  const [showUpdatePluginsForm, setShowUpdatePluginsForm] = useState<boolean>(false);
  const [showOtaProgress, setShowOtaProgress] = useState<boolean>(false);
  const [otaFormData, setOtaFormData] = useState<OtaFormData>({
    ota_zip_file: null,
  });
  const [updatePluginsFormData, setUpdatePluginsFormData] = useState<OtaFormData>({
    ota_zip_file: null,
  });
  const [showCompletionPopup, setShowCompletionPopup] = useState<boolean>(false);
  const [completedOperation, setCompletedOperation] = useState<'config' | 'update' | null>(null);

  // Socket event handlers
  const eventHandlers: EventHandlers = {
    handleTerminalOutput: true,
    onConnect: () => {
      console.log('Connected to OTA update namespace');
    },
    // Installation process events (for operation_type: 'install')
    installation_started: (_, { clearTerminal, updateState }) => {
      clearTerminal();
      updateState({
        isInstalling: true,
        installationSuccessful: false,
        installationError: null,
        showNextButton: false,
        installationFailed: false,
      });
      setCompletedOperation('config');
    },
    installation_complete: (data, { updateState }) => {
      if (data.status === 'success') {
        updateState({
          installationSuccessful: true,
          showNextButton: true,
          isInstalling: false,
        });
      }
    },
    installation_failed: (data, { updateState }) => {
      updateState({
        installationError: data.error,
        installationFailed: true,
        isInstalling: false,
      });
    },
    // Update process events (for operation_type: 'update')
    ota_update_started: (_, { clearTerminal, updateState }) => {
      clearTerminal();
      updateState({
        isInstalling: true,
        installationSuccessful: false,
        installationError: null,
        showNextButton: false,
        installationFailed: false,
      });
      setCompletedOperation('update');
    },
    ota_update_complete: (data, { updateState }) => {
      if (data.status === 'success') {
        updateState({
          installationSuccessful: true,
          showNextButton: true,
          isInstalling: false,
        });
      }
    },
    ota_update_failed: (data, { updateState }) => {
      updateState({
        installationError: data.error,
        installationFailed: true,
        isInstalling: false,
      });
    }
  };

  // Initialize socket with useSocket hook
  const {
    terminalOutput,
    state: {
      isInstalling = false,
      installationSuccessful = false,
      installationError = null,
      showNextButton = false,
    },
    clearTerminal: clearTerminalOutput,
    updateState,
  } = useSocket('/ota-update' as SocketNamespace, {
    eventHandlers,
    initialState: {
      isInstalling: false,
      installationSuccessful: false,
      installationError: null,
      showNextButton: false,
      installationFailed: false,
    }
  });

  const handleOtaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, files } = e.target;
    if (files) {
      setOtaFormData(prev => ({
        ...prev,
        [id]: files[0]
      }));
    }
  };

  const handleOtaClose = () => {
    setShowOtaForm(false);
    setOtaFormData({
      ota_zip_file: null,
    });
  };

  const handleOtaSubmit = async () => {
    try {
      if (!otaFormData.ota_zip_file || !otaFormData.ota_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid OTA plugins ZIP file');
      }

      setShowOtaProgress(true);
      setShowOtaForm(false);

      const formDataToSend = new FormData();
      formDataToSend.append('ota_zip_file', otaFormData.ota_zip_file);
      formDataToSend.append('operation_type', 'install');

      const response = await fetch('/api/ota/ota-update', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Configuration failed');
      }
    } catch (error) {
      console.error('OTA configuration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Configuration failed';
      updateState({
        installationError: errorMessage,
        installationFailed: true,
        isInstalling: false,
      });
    }
  };

  const handleUpdatePluginsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, files } = e.target;
    if (files) {
      setUpdatePluginsFormData(prev => ({
        ...prev,
        [id]: files[0]
      }));
    }
  };

  const handleUpdatePluginsClose = () => {
    setShowUpdatePluginsForm(false);
    setUpdatePluginsFormData({
      ota_zip_file: null,
    });
  };

  const handleUpdatePluginsSubmit = async () => {
    try {
      if (!updatePluginsFormData.ota_zip_file || !updatePluginsFormData.ota_zip_file.name.endsWith('.zip')) {
        throw new Error('Please select a valid plugins ZIP file');
      }

      setShowOtaProgress(true);
      setShowUpdatePluginsForm(false);

      const formDataToSend = new FormData();
      formDataToSend.append('ota_zip_file', updatePluginsFormData.ota_zip_file);
      formDataToSend.append('operation_type', 'update');

      const response = await fetch('/api/ota/ota-update', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }
    } catch (error) {
      console.error('Plugin update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      updateState({
        installationError: errorMessage,
        installationFailed: true,
        isInstalling: false,
      });
    }
  };

  const handleNext = () => {
    setShowOtaProgress(false);
    setShowCompletionPopup(true);
  };

  const handleComplete = () => {
    setShowCompletionPopup(false);
    setShowOtaProgress(false);
    clearTerminalOutput();
    handleOtaClose();
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg shadow-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">Advanced Features</h3>

            <div className="bg-sidebar border border-border p-4 rounded-lg mb-4">
              <p className="text-sm text-primary">
                Once configured, use https://your-ip-address:8443/ota/plugins in ATAK for update url to check for plugins and install them
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="primary"
              onClick={() => setShowOtaForm(true)}
              tooltip="First time installation only"
              tooltipStyle="shadcn"
              tooltipDelay={1000}
              showHelpIcon={false}
            >
              Configure OTA Updates
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowUpdatePluginsForm(true)}
              tooltip="Update or add new plugins for OTA updates"
              tooltipStyle="shadcn"
              tooltipDelay={1000}
              showHelpIcon={false}
            >
              Update Plugins
            </Button>
          </div>
        </div>
      </div>

      {/* OTA Configuration Form */}
      {showOtaForm && (
        <div className="w-full border border-border bg-card p-6 rounded-lg shadow-lg">
          <h3 className="text-base font-bold mb-4 text-primary">OTA Updates Configuration</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                OTA (Over-The-Air) updates enable ATAK users to easily discover and install available plugins and ATAK versions directly from their devices. 
                This feature streamlines the distribution of updates and new capabilities to your ATAK users without requiring manual installation. Download the plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-textSecondary">TAK.gov</a> and upload it here.
              </p>
            </div>

            {/* OTA Configuration Summary */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Configuration Summary</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>This will configure OTA (Over-The-Air) updates for ATAK clients</li>
                <li>The process will update the Dockerfile and docker-compose configuration</li>
                <li>TAK Server containers will be rebuilt and restarted</li>
                <li>Existing plugins folder will be removed and replaced with the new content</li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm dark:text-yellow-400 text-yellow-600 mb-2">
              All fields are required
            </div>

            {/* Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleOtaSubmit();
            }} className="space-y-4">
              {/* File Upload Section */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-primary flex items-center gap-1">
                  Plugins ZIP File 
                  <HelpIconTooltip
                    tooltip="Select the OTA plugins ZIP file downloaded from TAK.gov"
                    iconSize={14}
                  />
                  <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-muted-foreground">Example: ATAK-MIL_5.2.0_loadout.zip</p>
                <input
                  type="file"
                  id="ota_zip_file"
                  onChange={handleOtaInputChange}
                  className="w-full text-sm p-2 rounded-lg bg-sidebar border border-inputBorder focus:border-accentBorder focus:outline-none"
                  accept=".zip"
                  required
                />
              </div>

              <div className="flex justify-end gap-4 mt-4">
                <Button
                  variant="secondary"
                  onClick={handleOtaClose}
                  type="button"
                  className="hover:bg-red-500"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="hover:bg-green-500"
                  loading={isInstalling}
                  loadingText="Configuring..."
                  disabled={!otaFormData.ota_zip_file}
                  tooltipStyle="shadcn"
                  tooltip={!otaFormData.ota_zip_file ? "Please select a valid plugins ZIP file" : undefined}
                  tooltipPosition="top"
                  tooltipDelay={200}
                >
                  Begin Configuration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Plugins Form */}
      {showUpdatePluginsForm && (
        <div className="w-full border border-border bg-card p-6 rounded-lg shadow-lg">
          <h3 className="text-base font-bold mb-4 text-primary">Update TAK Server Plugins</h3>
          
          <div className="flex flex-col gap-4">
            {/* Purpose Section */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Update the plugins available through OTA updates on your TAK Server. This allows you to add new plugins or update existing ones
                that will be available to your ATAK users.
              </p>
            </div>

            {/* Update Summary */}
            <div className="bg-background border border-border p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold text-selectedColor mb-2">Update Summary</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>This will update the available plugins for OTA updates</li>
                <li>Existing plugins folder will be removed and replaced with the new content</li>
                <li>TAK Server will be restarted to apply the changes</li>
              </ul>
            </div>

            {/* Required Fields Note */}
            <div className="text-sm dark:text-yellow-400 text-yellow-600 mb-2">
              All fields are required
            </div>

            {/* Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdatePluginsSubmit();
            }} className="space-y-4">
              {/* File Upload Section */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-primary flex items-center gap-1">
                  Plugins ZIP File 
                  <HelpIconTooltip
                    tooltip="Select the updated plugins ZIP file downloaded from TAK.gov"
                    iconSize={14}
                  />
                  <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-muted-foreground">Example: ATAK-MIL_5.2.0_loadout.zip</p>
                <input
                  type="file"
                  id="ota_zip_file"
                  onChange={handleUpdatePluginsInputChange}
                  className="w-full text-sm p-2 rounded-lg bg-sidebar border border-inputBorder focus:border-accentBorder focus:outline-none"
                  accept=".zip"
                  required
                />
              </div>

              <div className="flex justify-end gap-4 mt-4">
                <Button
                  variant="secondary"
                  onClick={handleUpdatePluginsClose}
                  type="button"
                  className="hover:bg-red-500"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="hover:bg-green-500"
                  loading={isInstalling}
                  loadingText="Updating..."
                  disabled={!updatePluginsFormData.ota_zip_file}
                  tooltipStyle="shadcn"
                  tooltip={!updatePluginsFormData.ota_zip_file ? "Please select a valid plugins ZIP file" : undefined}
                  tooltipPosition="top"
                  tooltipDelay={200}
                >
                  Begin Update
                </Button>
              </div>
            </form>
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
          <Button
            variant="primary"
            onClick={handleComplete}
          >
            Close
          </Button>
        }
      >
        <div className="text-center">
          <p className="text-green-500 font-semibold">��</p>
          {completedOperation === 'config' ? (
            <>
              <p className="text-green-500 font-semibold">OTA Plugins Configuration Completed Successfully</p>
              <p className="text-sm text-primary">
                Your TAK Server is now configured to provide OTA updates to ATAK clients.
              </p>
            </>
          ) : (
            <>
              <p className="text-green-500 font-semibold">Plugin Update Completed Successfully</p>
              <p className="text-sm text-primary">
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