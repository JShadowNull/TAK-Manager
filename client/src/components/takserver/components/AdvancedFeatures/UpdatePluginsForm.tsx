import React, { useState } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import { Input } from '../../../shared/ui/shadcn/input';
import { HelpIconTooltip } from '../../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { z } from 'zod';

interface UpdatePluginsFormProps {
  onClose: () => void;
  onUpdateStart: () => void;
}

// Form validation schema
const formSchema = z.object({
  ota_zip_file: z.instanceof(File, { message: "Plugin ZIP file is required" })
    .refine((file) => file.name.endsWith('.zip'), "File must be a ZIP file")
    .refine(
      (file) => file.size <= 8000000000, // 8GB max
      "File size must be less than 8GB"
    ),
});

interface UpdatePluginsFormData {
  ota_zip_file: File | null;
}

const UpdatePluginsForm: React.FC<UpdatePluginsFormProps> = ({ onClose, onUpdateStart }) => {
  const [formData, setFormData] = useState<UpdatePluginsFormData>({
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
    setFormData(prev => ({ ...prev, ota_zip_file: file || null }));
    if (file) {
      validateField('ota_zip_file', file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!formData.ota_zip_file) return;

    try {
      formSchema.parse(formData);
      
      // Clear any previous errors before making API call
      setErrors({});

      const uploadData = new FormData();
      uploadData.append('file', formData.ota_zip_file);

      onUpdateStart();

      const response = await fetch('/api/ota/update', {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Plugin update error:', error);
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
    setFormData(prev => ({ ...prev, ota_zip_file: null }));
    setErrors({});
  };

  return (
    <div className="w-full border border-border bg-card p-6 rounded-lg break-normal">
      <h3 className="text-base font-bold mb-4">Update TAK Server Plugins</h3>
      
      <div className="flex flex-col gap-4">
        <div className="bg-background border border-border p-4 rounded-lg mb-4">
          <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Update the plugins available through OTA updates on your TAK Server. This allows you to add new plugins or update existing ones
            that will be available to your ATAK users. Download the updated plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-textSecondary">TAK.gov</a> and upload it here.
          </p>
        </div>

        <div className="bg-background border border-border p-4 rounded-lg mb-4">
          <h4 className="text-sm font-semibold text-selectedColor mb-2">Update Summary</h4>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>This will update the available plugins for OTA updates</li>
            <li>Existing plugins folder will be removed and replaced with the new content</li>
            <li>TAK Server will be restarted to apply the changes</li>
          </ul>
        </div>

        <div className="text-sm dark:text-yellow-400 text-yellow-600 mb-2">
          All fields are required
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-primary flex items-center gap-1">
              Plugins ZIP File 
              <HelpIconTooltip
                tooltip="Select the ZIP file containing the updated or new plugins"
                iconSize={14}
              />
              <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-muted-foreground">Example: ATAK-MIL_5.2.0_loadout.zip</p>
            
            <Input
              type="file"
              id="plugin_zip_file"
              name="plugin_zip_file"
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
              Begin Update
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdatePluginsForm; 