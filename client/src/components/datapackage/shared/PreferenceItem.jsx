import React from 'react';
import { Input } from '../../shared/ui/shadcn/input';
import { Checkbox } from '../../shared/ui/shadcn/checkbox';
import { cn } from '@/lib/utils';

const PreferenceItem = ({
  name,
  label,
  input_type,
  value,
  options = [],
  onChange,
  onBlur,
  onPreferenceEnableChange,
  isPreferenceEnabled = false,
  isCertificateDropdown,
  min,
  max,
  required,
  placeholder,
  showLabel = true,
  showEnableToggle = true
}) => {
  return (
    <div className="preference-item w-full py-2">
      <div className="flex items-start gap-4">
        {showEnableToggle && (
          <div className="flex-none pt-1">
            <Checkbox
              checked={isPreferenceEnabled}
              onCheckedChange={(checked) => onPreferenceEnableChange(checked)}
              aria-label={`Enable/Disable ${name}`}
            />
          </div>
        )}
        
        <div className={`flex-grow min-w-0 ${!isPreferenceEnabled ? 'opacity-50' : ''}`}>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium leading-tight break-normal pr-4">
              {name}
            </div>
            
            {showLabel && label && (
              <div className="text-xs text-muted-foreground break-normal">
                {label}
              </div>
            )}
          </div>
        </div>

        <div className="flex-none w-[200px]">
          <Input
            id={label}
            type={input_type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            options={options}
            isCertificateDropdown={isCertificateDropdown}
            disabled={!isPreferenceEnabled}
            min={min}
            max={max}
            required={required}
            placeholder={placeholder || (input_type === 'select' ? 'Select item...' : '')}
            className={cn(
              "w-full items-end",
              input_type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default PreferenceItem; 