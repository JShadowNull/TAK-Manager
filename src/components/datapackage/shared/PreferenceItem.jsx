import React from 'react';
import InputField from '../../shared/ui/InputField';

const PreferenceItem = ({
  name,
  label,
  input_type,
  value,
  checked,
  options = [],
  onChange,
  onBlur,
  onPreferenceEnableChange,
  isPreferenceEnabled = true,
  isCertificateDropdown,
  min,
  max,
  required
}) => {
  return (
    <div className="preference-item w-full">
      <div className="flex items-center mb-1 w-full">
        <input 
          type="checkbox" 
          className="preference-inclusion-toggle mr-2 flex-shrink-0"
          checked={isPreferenceEnabled}
          onChange={(e) => onPreferenceEnableChange(e.target.checked)}
          title="Enable/Disable this preference in configuration"
        />
        
        <div className={`input-area flex justify-between items-center w-full ${!isPreferenceEnabled ? 'opacity-50' : ''}`}>
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
              disabled={!isPreferenceEnabled}
              isPreferenceValueCheckbox={input_type === 'checkbox'}
              min={min}
              max={max}
              required={required}
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