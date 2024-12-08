import React from 'react';

/**
 * A versatile input field component that can render different types of inputs:
 * - Text input with optional search icon
 * - Search input with centered text and search icon
 * - Select dropdown for certificates
 * - Checkbox with custom styling for preferences
 * 
 * @param {string} id - Unique identifier for the input
 * @param {string} type - Input type ('text', 'search', 'select', 'checkbox')
 * @param {string} placeholder - Placeholder text for text inputs
 * @param {string|boolean} value - Current input value
 * @param {function} onChange - Handler for value changes
 * @param {string} className - Additional CSS classes
 * @param {Array} options - Options for select dropdown [{value, text}]
 * @param {boolean} isCertificateDropdown - Whether this is a certificate selector
 * @param {boolean} checked - Checkbox checked state
 * @param {boolean} disabled - Whether input is disabled
 * @param {boolean} isPreferenceCheckbox - Whether to use custom preference checkbox styling
 */
const InputField = ({ 
  id, 
  type = "text",
  placeholder, 
  value, 
  onChange, 
  className = "",
  options = [],
  isCertificateDropdown = false,
  checked,
  disabled,
  isPreferenceCheckbox = false,
}) => {
  // Search input with centered text and search icon
  if (type === 'search') {
    return (
      <div className="relative w-1/2">
        <input 
          type="text"
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            w-full p-2 text-sm text-center 
            bg-buttonColor border border-buttonBorder rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }

  // Certificate dropdown select input
  if (type === 'select') {
    console.log(`InputField ${id} options:`, options);
    return (
      <div className="relative w-full">
        <select 
          className={`
            ${isCertificateDropdown ? 'cert-select' : ''} 
            dropdown w-full bg-buttonColor text-sm border border-buttonBorder 
            p-2 pl-3 pr-10 rounded-lg cursor-pointer appearance-none 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          value={value || ''}
          onChange={onChange}
          name={id}
          disabled={disabled}
          data-certificate-dropdown={isCertificateDropdown}
        >
          {Array.isArray(options) && options.length > 0 ? (
            <>
              <option value="">{isCertificateDropdown ? "Select Certificate..." : "Select..."}</option>
              {options.map((option, index) => (
                <option key={`${option.value}-${index}`} value={option.value}>
                  {option.text || option.value}
                </option>
              ))}
            </>
          ) : (
            <option value="">{isCertificateDropdown ? "No certificates available" : "No options available"}</option>
          )}
        </select>
        <div className="absolute inset-y-0 right-2 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }

  // Custom styled checkbox for preferences
  if (type === 'checkbox' && isPreferenceCheckbox) {
    return (
      <div className="relative">
        <input 
          type="checkbox"
          className="peer appearance-none w-4 h-4 bg-transparent border-2 border-transparent rounded cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        {/* Checkmark icon shown when checked */}
        <svg className="absolute inset-0 text-green-500 pointer-events-none hidden peer-checked:block w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
          <path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
        </svg>
        {/* X icon shown when unchecked */}
        <svg className="absolute inset-0 text-red-500 pointer-events-none hidden peer-[&:not(:checked)]:block w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
          <path fill="currentColor" d="M376.6 84.5c11.3-13.6 9.5-33.8-4.1-45.1s-33.8-9.5-45.1 4.1L192 206 56.6 43.5C45.3 29.9 25.1 28.1 11.5 39.4S-3.9 70.9 7.4 84.5L150.3 256 7.4 427.5c-11.3 13.6-9.5 33.8 4.1 45.1s33.8 9.5 45.1-4.1L192 306 327.4 468.5c11.3 13.6 31.5 15.4 45.1 4.1s15.4-31.5 4.1-45.1L233.7 256 376.6 84.5z"/>
        </svg>
      </div>
    );
  }

  // Default text input
  return (
    <div className="relative w-full">
      <input 
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full bg-buttonColor text-sm border border-buttonBorder 
          p-2 rounded-lg cursor-pointer text-buttonTextColor 
          placeholder-textSecondary
          focus:outline-none focus:ring-2 focus:ring-blue-500 
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      />
    </div>
  );
};

export default InputField;