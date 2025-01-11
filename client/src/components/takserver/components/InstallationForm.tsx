import React, { useState } from 'react';
import { Input } from '../../shared/ui/shadcn/input';
import { Button } from '../../shared/ui/shadcn/button';
import { FormState, formSchema } from '../types/index';
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
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
    const { id, value, files } = e.target;
    if (id === 'docker_zip_file' && files?.length) {
      validateField(id, files[0]);
    } else {
      validateField(id, value);
    }
    onInputChange(e);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      formSchema.parse({
        ...formData,
        docker_zip_file: formData.docker_zip_file || new File([], '')
      });
      onSubmit(e);
    } catch (error: any) {
      const newErrors: { [key: string]: string } = {};
      error.errors?.forEach((err: any) => {
        if (err.path?.[0]) {
          newErrors[err.path[0]] = err.message;
        }
      });
      setErrors(newErrors);
    }
  };

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
  );
};

export default InstallationForm; 