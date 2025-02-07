import React from 'react';
import { Input } from "@/components/shared/ui/shadcn/input";
import { Label } from "@/components/shared/ui/shadcn/label";
import { Switch } from "@/components/shared/ui/shadcn/switch";
import { cn } from "@/lib/utils";

export interface PreferenceOption {
  value: string;
  text: string;
}

export interface PreferenceItemProps {
  name: string;
  label: string;
  input_type: 'text' | 'select' | 'number' | 'password';
  value: string;
  options?: PreferenceOption[];
  onChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void;
  onBlur?: () => void;
  onPreferenceEnableChange: (enabled: boolean) => void;
  isPreferenceEnabled?: boolean;
  isCertificateDropdown?: boolean;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  min?: number;
  max?: number;
  showLabel?: boolean;
  showEnableToggle?: boolean;
  error?: string;
}

const PreferenceItem: React.FC<PreferenceItemProps> = ({
  name,
  label,
  input_type,
  value,
  options = [],
  onChange,
  onBlur,
  onPreferenceEnableChange,
  isPreferenceEnabled = false,
  isCertificateDropdown = false,
  required = false,
  placeholder = '',
  defaultValue,
  min,
  max,
  showLabel = true,
  showEnableToggle = true,
  error
}) => {
  // Use defaultValue if value is empty and defaultValue exists
  const effectiveValue = (!value && defaultValue) ? defaultValue : value;

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        {showLabel && (
          <Label htmlFor={label} className="text-sm font-medium">
            {name}
          </Label>
        )}
        {showEnableToggle && (
          <Switch
            checked={isPreferenceEnabled}
            onCheckedChange={onPreferenceEnableChange}
            aria-label={`Enable ${name}`}
          />
        )}
      </div>
      <Input
        id={label}
        type={input_type === 'select' ? 'select' : input_type}
        value={effectiveValue}
        onChange={onChange}
        onBlur={onBlur}
        disabled={!isPreferenceEnabled}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className={cn(
          "w-fit",
          error && "border-red-500"
        )}
        options={options}
        isCertificateDropdown={isCertificateDropdown}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default PreferenceItem; 