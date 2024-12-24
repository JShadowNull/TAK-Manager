import React, { useState, useEffect } from 'react';
import { Input } from '../../shared/ui/shadcn/input';
import { Button } from '../../shared/ui/shadcn/button';
import { FormState, formSchema } from '../types';
import { z } from 'zod';
import { HelpIconTooltip } from '../../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { Eye, EyeOff } from 'lucide-react';

interface InstallationFormProps {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

const InstallationForm: React.FC<InstallationFormProps> = ({
  formData,
  onInputChange,
  onSubmit,
  onCancel
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showPostgresPassword, setShowPostgresPassword] = useState(false);
  const [showCertificatePassword, setShowCertificatePassword] = useState(false);

  // Validate form data whenever it changes
  useEffect(() => {
    try {
      const dataToValidate = {
        ...formData,
        docker_zip_file: formData.docker_zip_file || undefined
      };
      formSchema.parse(dataToValidate);
      setErrors({});
      setIsValid(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const field = err.path[0] as string;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
        setIsValid(false);
      }
    }
  }, [formData]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    if (isValid) {
      onSubmit(e);
    }
  };

  // Helper to determine if we should show error for a field
  const shouldShowError = (fieldId: string) => hasAttemptedSubmit && errors[fieldId];

  return (
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
              onChange={onInputChange}
              className={`w-full text-sm p-2 rounded-lg bg-sidebar border ${shouldShowError('docker_zip_file') ? 'border-red-500' : 'border-inputBorder'} focus:border-accentBorder focus:outline-none`}
              accept=".zip"
              required
            />
            {shouldShowError('docker_zip_file') && (
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
                  type={showPostgresPassword ? "text" : "password"}
                  value={formData.postgres_password}
                  onChange={onInputChange}
                  placeholder="Enter PostgreSQL password (min. 8 characters)"
                  className={`w-full ${shouldShowError('postgres_password') ? 'border-red-500' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPostgresPassword(!showPostgresPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPostgresPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {shouldShowError('postgres_password') && (
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
                  type={showCertificatePassword ? "text" : "password"}
                  value={formData.certificate_password}
                  onChange={onInputChange}
                  placeholder="Enter certificate password (min. 8 characters)"
                  className={`w-full ${shouldShowError('certificate_password') ? 'border-red-500' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCertificatePassword(!showCertificatePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCertificatePassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {shouldShowError('certificate_password') && (
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
                onChange={onInputChange}
                placeholder="Enter organization name"
                className={`w-full ${shouldShowError('organization') ? 'border-red-500' : ''}`}
                required
              />
              {shouldShowError('organization') && (
                <p className="text-sm text-red-500">{errors.organization}</p>
              )}
            </div>

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
                onChange={onInputChange}
                placeholder="Enter organizational unit"
                className={`w-full ${shouldShowError('organizational_unit') ? 'border-red-500' : ''}`}
                required
              />
              {shouldShowError('organizational_unit') && (
                <p className="text-sm text-red-500">{errors.organizational_unit}</p>
              )}
            </div>

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
                onChange={onInputChange}
                placeholder="Enter state or province"
                className={`w-full ${shouldShowError('state') ? 'border-red-500' : ''}`}
                required
              />
              {shouldShowError('state') && (
                <p className="text-sm text-red-500">{errors.state}</p>
              )}
            </div>

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
                onChange={onInputChange}
                placeholder="Enter city"
                className={`w-full ${shouldShowError('city') ? 'border-red-500' : ''}`}
                required
              />
              {shouldShowError('city') && (
                <p className="text-sm text-red-500">{errors.city}</p>
              )}
            </div>

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
                onChange={onInputChange}
                placeholder="Enter administrator name"
                className={`w-full ${shouldShowError('name') ? 'border-red-500' : ''}`}
                required
              />
              {shouldShowError('name') && (
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
              tooltipStyle="shadcn"
              tooltip={hasAttemptedSubmit && !isValid ? "Please fill out all fields correctly" : undefined}
              tooltipPosition="top"
              tooltipDelay={200}
            >
              Begin Installation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InstallationForm; 