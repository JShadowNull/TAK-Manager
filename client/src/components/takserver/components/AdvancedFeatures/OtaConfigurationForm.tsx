import React, { useState } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import { Input } from '../../../shared/ui/shadcn/input';
import { HelpIconTooltip } from '../../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import OtaPopups from './OtaPopups';

interface OtaConfigurationFormProps {
  onClose: () => void;
  onConfigureStart: () => void;
}

interface OtaFormData {
  ota_zip_file: File | null;
}

const OtaConfigurationForm: React.FC<OtaConfigurationFormProps> = ({ onClose }) => {
  const [otaFormData, setOtaFormData] = useState<OtaFormData>({
    ota_zip_file: null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showConfigureProgress, setShowConfigureProgress] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validateField = (name: string, value: any) => {
    if (name === 'ota_zip_file') {
      if (!value) {
        return 'OTA ZIP file is required';
      }
      if (!(value instanceof File)) {
        return 'Invalid file type';
      }
      if (!value.name.toLowerCase().endsWith('.zip')) {
        return 'File must be a ZIP file';
      }
      if (value.size > 8000000000) {
        return 'File size must be less than 8GB';
      }
      return '';
    }
    return '';
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setOtaFormData(prev => ({ ...prev, ota_zip_file: file || null }));
    
    // Only validate and update errors if form has been submitted once
    if (hasAttemptedSubmit && file) {
      const fieldError = validateField('ota_zip_file', file);
      setErrors(prev => ({
        ...prev,
        ota_zip_file: fieldError,
        submit: '' // Clear any submit-level errors
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const fieldError = validateField('ota_zip_file', otaFormData.ota_zip_file);
    if (fieldError) {
      newErrors.ota_zip_file = fieldError;
    }
    return newErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    try {
      // Clear any previous errors and show progress popup before making API call
      setErrors({});
      setShowConfigureProgress(true);
      
      const formData = new FormData();
      if (otaFormData.ota_zip_file) {
        formData.append('file', otaFormData.ota_zip_file);
      }

      const response = await fetch('/api/ota/configure', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Configuration failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('OTA configuration error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred during configuration' });
    }
  };

  const handleConfigureComplete = () => {
    setShowConfigureProgress(false);
    onClose();
  };

  const handleClearFile = () => {
    setOtaFormData(prev => ({ ...prev, ota_zip_file: null }));
    setErrors({});
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg break-normal">
        <h3 className="text-base font-bold mb-4">OTA Updates Configuration</h3>
        
        <div className="flex flex-col gap-4">
          <div className="bg-background border border-border p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              OTA (Over-The-Air) updates enable ATAK users to easily discover and install available plugins and ATAK versions directly from their devices. 
              This feature streamlines the distribution of updates and new capabilities to your ATAK users without requiring manual installation. Download the plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-muted-foreground text-primary">TAK.gov</a> and upload it here.
            </p>
          </div>

          <div className="bg-background border border-border p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Configuration Summary</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>This will configure OTA (Over-The-Air) updates for ATAK clients</li>
              <li>The process will update the Dockerfile and docker-compose configuration</li>
              <li>TAK Server containers will be rebuilt and restarted</li>
              <li>Existing plugins folder will be removed and replaced with the new content</li>
            </ul>
          </div>

          <div className="text-sm dark:text-yellow-400 text-yellow-600 mb-2">
            All fields are required
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-primary flex items-center gap-1">
                OTA Updates ZIP File 
                <HelpIconTooltip
                  tooltip="Select the OTA updates ZIP file containing the plugins you want to make available for ATAK clients"
                  iconSize={14}
                />
                <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-muted-foreground">Example: ATAK-MIL_5.2.0_loadout.zip</p>
              
              <Input
                type="file"
                id="ota_zip_file"
                name="ota_zip_file"
                accept=".zip"
                onChange={handleInputChange}
                onClearFile={handleClearFile}
                error={errors.ota_zip_file}
                placeholder="Click to select or drag and drop your ZIP file"
                required
              />
            </div>

            <div className="flex justify-end gap-4 mt-4">
              <Button
                variant="secondary"
                onClick={onClose}
                type="button"
                className="hover:bg-red-500"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="hover:bg-green-500"
              >
                Begin Configuration
              </Button>
            </div>
          </form>
        </div>
      </div>

      <OtaPopups
        onConfigureComplete={handleConfigureComplete}
        onUpdateComplete={() => {}}
        showConfigureProgress={showConfigureProgress}
      />
    </>
  );
};

export default OtaConfigurationForm; 