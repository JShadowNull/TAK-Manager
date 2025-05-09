import React, { useState, useEffect } from 'react';
import { Button } from '../../../shared/ui/shadcn/button';
import { HelpIconTooltip } from '../../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import OtaPopups from './OtaPopups';
import { uploadWithProgress } from '../../../../utils/uploadProgress';

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

const UpdatePluginsForm: React.FC<UpdatePluginsFormProps> = ({ onClose }) => {
  const [formData, setFormData] = useState<UpdatePluginsFormData>({
    ota_zip_file: null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFormData(prev => ({ ...prev, ota_zip_file: file }));
      validateField('ota_zip_file', file);
      
      // Validate immediately if submission was attempted
      if (hasAttemptedSubmit) {
        validateField('ota_zip_file', file);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    maxSize: 8000000000, // 8GB
    multiple: false
  });

  useEffect(() => {
    window.handleNativeFileDrop = (fullPath: string) => {
      const file = new File([fullPath], fullPath.split('/').pop() || 'file.zip', {
        type: 'application/zip',
        lastModified: Date.now()
      });
      setFormData(prev => ({ ...prev, ota_zip_file: file }));
    };
  }, []);

  const validateForm = () => {
    try {
      formSchema.parse(formData);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path?.[0]) {
            newErrors[err.path[0]] = err.message;
          }
        });
        return newErrors;
      }
      return { submit: 'Validation failed' };
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    if (!formData.ota_zip_file) return;

    try {
      // Clear any previous errors and show progress popup before making API call
      setErrors({});
      setUploadProgress(0);
      setShowUpdateProgress(true);

      const uploadData = new FormData();
      uploadData.append('file', formData.ota_zip_file);


      // Use uploadWithProgress instead of fetch
      const response = await uploadWithProgress(
        '/api/ota/update',
        uploadData,
        (progress) => setUploadProgress(progress)
      );

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Plugin update error:', error);
      if (!showUpdateProgress) {
        setErrors({ submit: error instanceof Error ? error.message : 'An error occurred during update' });
      }
    }
  };

  const handleUpdateComplete = () => {
    setShowUpdateProgress(false);
    onClose();
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg break-normal">
        <h3 className="text-base font-bold mb-4">Update TAK Server Plugins</h3>
        
        <div className="flex flex-col gap-4">
          <div className="bg-background border border-border p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Update the plugins available through OTA updates on your TAK Server. This allows you to add new plugins or update existing ones
              that will be available to your ATAK users. Download the updated plugins ZIP file from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-muted-foreground text-primary">TAK.gov</a> and upload it here.
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
              
              <div {...getRootProps()} className="flex flex-col gap-2 cursor-pointer">
                <input {...getInputProps()} />
                <div className={`border-2 border-dashed rounded-lg p-6 text-center 
                  ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}
                  ${errors.ota_zip_file ? 'border-red-500' : ''}`}>
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isDragActive ? (
                        "Drop the ZIP file here"
                      ) : formData.ota_zip_file ? (
                        <span className="text-primary">{formData.ota_zip_file.name}</span>
                      ) : (
                        "Drag and drop your plugins ZIP file here, or click to select"
                      )}
                    </p>
                    {errors.ota_zip_file && (
                      <p className="text-sm text-red-500">{errors.ota_zip_file}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-end gap-4 mt-4">
              <Button
                variant="secondary"
                onClick={onClose}
                type="button"
                className="hover:bg-red-500 w-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="hover:bg-green-500 w-full"
              >
                Begin Update
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      <OtaPopups
        onConfigureComplete={() => {}}
        onUpdateComplete={handleUpdateComplete}
        showUpdateProgress={showUpdateProgress}
        updateUploadProgress={uploadProgress}
      />
    </>
  );
};

export default UpdatePluginsForm; 