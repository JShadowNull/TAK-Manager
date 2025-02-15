import React, { useState } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import { Input } from '../../../shared/ui/shadcn/input';
import { HelpIconTooltip } from '../../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { z } from 'zod';

interface OtaConfigurationFormProps {
  onClose: () => void;
  onConfigureStart: () => void;
}

// Form validation schema
const formSchema = z.object({
  ota_zip_file: z.instanceof(File, { message: "OTA ZIP file is required" })
    .refine((file) => file.name.endsWith('.zip'), "File must be a ZIP file")
    .refine(
      (file) => file.size <= 8000000000, // 8GB max
      "File size must be less than 8GB"
    ),
});

interface OtaFormData {
  ota_zip_file: File | null;
}

const OtaConfigurationForm: React.FC<OtaConfigurationFormProps> = ({ onClose, onConfigureStart }) => {
  const [otaFormData, setOtaFormData] = useState<OtaFormData>({
    ota_zip_file: null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateField = (name: string, value: any) => {
    try {
      if (name === 'ota_zip_file' && value instanceof File) {
        formSchema.shape.ota_zip_file.parse(value);
      }
      setErrors(prev => ({ ...prev, [name]: '' }));
    } catch (error: any) {
      setErrors(prev => ({ ...prev, [name]: error.errors?.[0]?.message || 'Invalid input' }));
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setOtaFormData(prev => ({ ...prev, ota_zip_file: file || null }));
    if (file) {
      validateField('ota_zip_file', file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!otaFormData.ota_zip_file) return;

    try {
      formSchema.parse(otaFormData);
      
      // Clear any previous errors before making API call
      setErrors({});

      const uploadData = new FormData();
      uploadData.append('file', otaFormData.ota_zip_file);

      onConfigureStart();

      const response = await fetch('/api/ota/configure', {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        throw new Error(`Configuration failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('OTA configuration error:', error);
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path?.[0]) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  const handleClearFile = () => {
    setOtaFormData(prev => ({ ...prev, ota_zip_file: null }));
    setErrors({});
  };

  return (
    <div className="w-full border border-border bg-card p-6 rounded-lg break-normal">
      <h3 className="text-base font-bold mb-4">OTA Updates Configuration</h3>
      
      <div className="flex flex-col gap-4">
        <div className="bg-background border border-border p-4 rounded-lg mb-4">
          <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            OTA (Over-The-Air) updates enable ATAK users to easily discover and install available plugins and ATAK versions directly from their devices. 
            This feature streamlines the distribution of updates and new capabilities to your ATAK users without requiring manual installation. Download the plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-textSecondary">TAK.gov</a> and upload it here.
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
              tooltipStyle="shadcn"
              tooltipPosition="top"
              tooltipDelay={200}
            >
              Begin Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OtaConfigurationForm; 