import React, { useState, useEffect } from 'react';
import { Button } from '../shared/ui/shadcn/button';
import OtaPopups from './components/AdvancedFeatures/OtaPopups';
import OtaConfigurationForm from './components/AdvancedFeatures/OtaConfigurationForm';
import UpdatePluginsForm from './components/AdvancedFeatures/UpdatePluginsForm';
import { Copy, RefreshCw } from 'lucide-react';
import { Input } from '../shared/ui/shadcn/input';
import { toast } from "../shared/ui/shadcn/toast/use-toast"


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

  const [inputValue, setInputValue] = useState<string>(() => {
    return localStorage.getItem('ota_url_link') || "https://your-ip-address:8443/plugins";
  });

  useEffect(() => {
    localStorage.setItem('ota_url_link', inputValue);
  }, [inputValue]);

  return (
    <>
      <div className="w-full border border-border bg-card p-4 xs:p-6 rounded-lg shadow-lg min-w-fit">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">Advanced Features</h3>

            <div className="bg-sidebar border border-border p-4 rounded-lg mb-4">
              <p className="text-sm text-primary">
                Once configured, enter your server ip address and port below and paste into ATAK for update url to check for plugins and install them
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Input 
                  type="text" 
                  id="ota-zip-file" 
                  value={inputValue}
                  className="w-1/3"
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <Button variant="outline" size="icon" className="w-10 h-10" tooltip="Copy to clipboard" triggerMode="hover" onClick={() => {
                  navigator.clipboard.writeText(inputValue);
                  toast({
                    title: "Copied to clipboard",
                    description: inputValue
                  });
                }}>
                  <Copy/>
                </Button>
                <Button variant="outline" size="icon" className="w-10 h-10" tooltip="Restore default url" triggerMode="hover" onClick={() => {
                  setInputValue("https://your-ip-address:8443/plugins");
                  toast({
                    title: "Default url restored",
                    description: "https://your-ip-address:8443/plugins"
                  });
                }}>
                  <RefreshCw/>
                </Button>
              </div>
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