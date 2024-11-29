import React from 'react';
import InputField from './InputField';

const PreferenceItem = ({
  name,
  label,
  input_type,
  value,
  checked,
  options,
  onChange,
  onEnableChange,
  isEnabled
}) => {
  return (
    <div className="preference-item">
      <div className="flex items-center mb-1">
        <input 
          type="checkbox" 
          className="enable-preference mr-2"
          checked={isEnabled}
          onChange={(e) => onEnableChange(e.target.checked)}
        />
        
        <div className="input-area flex justify-between items-center w-full">
          <span className="text-sm preference-label flex-1" data-label={label}>
            {name}
          </span>
          
          <div className="relative w-1/6 flex justify-end pr-4">
            <InputField
              id={label}
              type={input_type}
              value={value}
              checked={checked}
              onChange={onChange}
              options={options}
              isCertificateDropdown={label.toLowerCase().includes('certificate')}
              disabled={!isEnabled}
              isPreferenceCheckbox={input_type === 'checkbox'}
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