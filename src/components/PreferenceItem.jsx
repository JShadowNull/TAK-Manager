import React from 'react';
import InputField from './InputField';

const PreferenceItem = ({
  name,
  label,
  input_type,
  value,
  checked,
  options = [],
  onChange,
  onBlur,
  onEnableChange,
  isEnabled,
  isCertificateDropdown,
  min,
  max
}) => {
  return (
    <div className="preference-item w-full">
      <div className="flex items-center mb-1 w-full">
        <input 
          type="checkbox" 
          className="enable-preference mr-2 flex-shrink-0"
          checked={isEnabled}
          onChange={(e) => onEnableChange(e.target.checked)}
        />
        
        <div className={`input-area flex justify-between items-center w-full ${!isEnabled ? 'opacity-50' : ''}`}>
          <span className="text-sm preference-label truncate mr-4 flex-grow" data-label={label}>
            {name}
          </span>
          
          <div className="flex-shrink-0 flex justify-end w-48 mr-4">
            <InputField
              id={label}
              type={input_type}
              value={value}
              checked={checked}
              onChange={onChange}
              onBlur={onBlur}
              options={options}
              isCertificateDropdown={isCertificateDropdown || label.toLowerCase().includes('certificate') || label.toLowerCase().includes('ca')}
              disabled={!isEnabled}
              isPreferenceCheckbox={input_type === 'checkbox'}
              min={min}
              max={max}
              className={`cert-select ${input_type === 'select' ? 'dropdown' : ''}`}
              data-certificate-dropdown={isCertificateDropdown || label.toLowerCase().includes('certificate') || label.toLowerCase().includes('ca')}
            />
          </div>
        </div>
      </div>
      
      {label && (
        <div className="text-xs text-textSecondary ml-6">
          {label}
        </div>
      )}
    </div>
  );
};

export default PreferenceItem; 