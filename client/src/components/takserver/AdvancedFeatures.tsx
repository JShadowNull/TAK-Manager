import React, { useState } from 'react';
import { Button } from '../shared/ui/shadcn/button';
import OtaPopups from './components/AdvancedFeatures/OtaPopups';
import OtaConfigurationForm from './components/AdvancedFeatures/OtaConfigurationForm';
import UpdatePluginsForm from './components/AdvancedFeatures/UpdatePluginsForm';

const AdvancedFeatures: React.FC = () => {
  const [showOtaForm, setShowOtaForm] = useState<boolean>(false);
  const [showUpdatePluginsForm, setShowUpdatePluginsForm] = useState<boolean>(false);
  const [showConfigureProgress, setShowConfigureProgress] = useState(false);
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);

  const handleConfigureComplete = () => {
    setShowConfigureProgress(false);
  };

  const handleUpdateComplete = () => {
    setShowUpdateProgress(false);
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-4 xs:p-6 rounded-lg shadow-lg min-w-fit">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">Advanced Features</h3>

            <div className="bg-sidebar border border-border p-4 rounded-lg mb-4">
              <p className="text-sm text-primary">
                Once configured, use https://your-ip-address:8443/plugins in ATAK for update url to check for plugins and install them
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:justify-start gap-4">
            <Button
              variant="primary"
              onClick={() => setShowOtaForm(true)}
              tooltip="First time installation only"
              tooltipStyle="shadcn"
              tooltipDelay={1000}
              showHelpIcon={false}
              className="w-full lg:w-auto"
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
              className="w-full lg:w-auto"
            >
              Update Plugins
            </Button>
          </div>
        </div>
      </div>

      {/* OTA Configuration Form */}
      {showOtaForm && (
        <OtaConfigurationForm
          onClose={() => setShowOtaForm(false)}
          onConfigureStart={() => {
            setShowOtaForm(false);
            setShowConfigureProgress(true);
          }}
        />
      )}

      {/* Update Plugins Form */}
      {showUpdatePluginsForm && (
        <UpdatePluginsForm
          onClose={() => setShowUpdatePluginsForm(false)}
          onUpdateStart={() => {
            setShowUpdatePluginsForm(false);
            setShowUpdateProgress(true);
          }}
        />
      )}

      {/* Progress Popups */}
      <OtaPopups
        showConfigureProgress={showConfigureProgress}
        showUpdateProgress={showUpdateProgress}
        onConfigureComplete={handleConfigureComplete}
        onUpdateComplete={handleUpdateComplete}
      />
    </>
  );
};

export default AdvancedFeatures; 