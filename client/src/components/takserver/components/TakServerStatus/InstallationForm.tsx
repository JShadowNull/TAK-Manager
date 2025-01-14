import React, { useState } from 'react';
import { Input } from '../../../shared/ui/shadcn/input';
import { Button } from '../../../shared/ui/shadcn/button';
import { HelpIconTooltip } from '../../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import Popups from './TakOperationPopups';

// Form validation schema
const formSchema = z.object({
  docker_zip_file: z.instanceof(File, { message: "Docker ZIP file is required" })
    .refine((file) => file.name.endsWith('.zip'), "File must be a ZIP file")
    .refine(
      (file) => file.size <= 5000000000, // 5GB max
      "File size must be less than 5GB"
    ),
  postgres_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  certificate_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  organization: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Organization name can only contain letters, numbers, spaces, hyphens, underscores, and periods"
    ),
  state: z.string()
    .min(2, "State/Province must be at least 2 characters")
    .max(50, "State/Province must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "State/Province can only contain letters, spaces, hyphens, and apostrophes"
    ),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "City can only contain letters, spaces, hyphens, and apostrophes"
    ),
  organizational_unit: z.string()
    .min(2, "Organizational unit must be at least 2 characters")
    .max(100, "Organizational unit must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Organizational unit can only contain letters, numbers, spaces, hyphens, underscores, and periods"
    ),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
});

type FormData = {
  docker_zip_file: File | null;
  postgres_password: string;
  certificate_password: string;
  organization: string;
  state: string;
  city: string;
  organizational_unit: string;
  name: string;
};

interface InstallationFormProps {
  onCancel: () => void;
}

const InstallationForm: React.FC<InstallationFormProps> = ({
  onCancel
}) => {
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showInstallProgress, setShowInstallProgress] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    docker_zip_file: null,
    postgres_password: '',
    certificate_password: '',
    organization: '',
    state: '',
    city: '',
    organizational_unit: '',
    name: ''
  });

  const validateField = (name: string, value: any) => {
    try {
      if (name === 'docker_zip_file' && value instanceof File) {
        formSchema.shape.docker_zip_file.parse(value);
      } else {
        formSchema.shape[name as keyof typeof formSchema.shape].parse(value);
      }
      setErrors(prev => ({ ...prev, [name]: '' }));
    } catch (error: any) {
      setErrors(prev => ({ ...prev, [name]: error.errors?.[0]?.message || 'Invalid input' }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, files, type } = e.target;
    const newValue = type === 'file' ? files?.[0] || null : value;
    
    setFormData(prev => ({
      ...prev,
      [id]: newValue
    }));
    
    validateField(id, newValue);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      formSchema.parse(formData);
      
      // Clear any previous errors and show progress popup before making API call
      setErrors({});
      setShowInstallProgress(true);
      
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null) {
          formDataToSend.append(key, value);
        }
      });

      const response = await fetch('/api/takserver/install-takserver', {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error(`Installation failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Installation error:', error);
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path?.[0]) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
        setShowInstallProgress(false); // Only close on validation error
      }
    }
  };

  const handleInstallComplete = () => {
    setShowInstallProgress(false); // Only close after user acknowledges completion
    onCancel(); // Close the form
  };

  return (
    <>
      <div className="w-full border border-border bg-card p-6 rounded-lg">
        <h3 className="text-base font-bold mb-4">Installation Configuration</h3>
        
        <div className="flex flex-col gap-4">
          {/* Purpose Section */}
          <div className="bg-background border border-border p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TAK Server is a powerful middleware solution that enables real-time situational awareness and information sharing. 
              It acts as a central hub for connecting ATAK clients, managing user authentication, and facilitating secure data exchange between team members. 
              The server provides essential features like data persistence, user management, and mission data sharing capabilities.
            </p>
          </div>

          {/* Installation Summary */}
          <div className="bg-background border border-border p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Installation Summary</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>This will install TAK Server and PostgreSQL database within Docker Desktop</li>
              <li>Certificate enrollment will be configured by default for client authentication</li>
              <li>All data will be stored in your Documents folder using Docker volumes</li>
              <li>For the TAK Server ZIP file, please download the Docker version from <a href="https://tak.gov/products/tak-server" target="_blank" rel="noopener noreferrer" className="foreground hover:text-textSecondary">TAK.gov</a></li>
            </ul>
          </div>

          {/* Required Fields Note */}
          <div className="text-sm dark:text-yellow-400 text-yellow-600 mb-2">
            All fields are required
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload Section */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-primary">
                Docker ZIP File <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-muted-foreground">Example: takserver-docker-5.2-RELEASE-43.zip</p>
              <input
                type="file"
                id="docker_zip_file"
                onChange={handleInputChange}
                className="w-full text-sm p-2 rounded-lg bg-sidebar border border-inputBorder focus:border-accentBorder focus:outline-none"
                accept=".zip"
                required
              />
              {errors.docker_zip_file && (
                <p className="text-sm text-red-500">{errors.docker_zip_file}</p>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Password Fields */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    Database Password 
                    <HelpIconTooltip
                      tooltip="Password must be at least 8 characters"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <Input
                    id="postgres_password"
                    type={showDbPassword ? "text" : "password"}
                    value={formData.postgres_password}
                    onChange={handleInputChange}
                    placeholder="Enter PostgreSQL password (min. 8 characters)"
                    className={`w-full pr-10 ${errors.postgres_password ? 'border-red-500' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDbPassword(!showDbPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showDbPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.postgres_password && (
                  <p className="text-sm text-red-500">{errors.postgres_password}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    Certificate Password 
                    <HelpIconTooltip
                      tooltip="Password must be at least 8 characters"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <Input
                    id="certificate_password"
                    type={showCertPassword ? "text" : "password"}
                    value={formData.certificate_password}
                    onChange={handleInputChange}
                    placeholder="Enter certificate password (min. 8 characters)"
                    className={`w-full pr-10 ${errors.certificate_password ? 'border-red-500' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCertPassword(!showCertPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showCertPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.certificate_password && (
                  <p className="text-sm text-red-500">{errors.certificate_password}</p>
                )}
              </div>

              {/* Organization Details */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    Organization 
                    <HelpIconTooltip
                      tooltip="Organization name can only contain letters, numbers, spaces, hyphens, underscores, and periods"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <Input
                  id="organization"
                  type="text"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder="Enter organization name"
                  className={`w-full ${errors.organization ? 'border-red-500' : ''}`}
                  required
                />
                {errors.organization && (
                  <p className="text-sm text-red-500">{errors.organization}</p>
                )}
              </div>

              {/* Organizational Unit */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    Organizational Unit 
                    <HelpIconTooltip
                      tooltip="Organizational unit can only contain letters, numbers, spaces, hyphens, underscores, and periods"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <Input
                  id="organizational_unit"
                  type="text"
                  value={formData.organizational_unit}
                  onChange={handleInputChange}
                  placeholder="Enter organizational unit"
                  className={`w-full ${errors.organizational_unit ? 'border-red-500' : ''}`}
                  required
                />
                {errors.organizational_unit && (
                  <p className="text-sm text-red-500">{errors.organizational_unit}</p>
                )}
              </div>

              {/* State/Province */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    State/Province 
                    <HelpIconTooltip
                      tooltip="State/Province can only contain letters, spaces, hyphens, and apostrophes"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <Input
                  id="state"
                  type="text"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="Enter state or province"
                  className={`w-full ${errors.state ? 'border-red-500' : ''}`}
                  required
                />
                {errors.state && (
                  <p className="text-sm text-red-500">{errors.state}</p>
                )}
              </div>

              {/* City */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    City 
                    <HelpIconTooltip
                      tooltip="City can only contain letters, spaces, hyphens, and apostrophes"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <Input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Enter city"
                  className={`w-full ${errors.city ? 'border-red-500' : ''}`}
                  required
                />
                {errors.city && (
                  <p className="text-sm text-red-500">{errors.city}</p>
                )}
              </div>

              {/* Name */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-primary flex items-center gap-1">
                    Name 
                    <HelpIconTooltip
                      tooltip="Name can only contain letters, spaces, hyphens, and apostrophes"
                      iconSize={14}
                    />
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter administrator name"
                  className={`w-full ${errors.name ? 'border-red-500' : ''}`}
                  required
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-4">
              <Button
                onClick={onCancel}
                variant="secondary"
                className="hover:bg-red-500"
                type="button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="hover:bg-green-500"
              >
                Begin Installation
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Popups
        showUninstallConfirm={false}
        onUninstallConfirmClose={() => {}}
        onUninstallConfirm={() => {}}
        onInstallComplete={handleInstallComplete}
        onUninstallComplete={() => {}}
        showInstallProgress={showInstallProgress}
      />
    </>
  );
};

export default InstallationForm; 