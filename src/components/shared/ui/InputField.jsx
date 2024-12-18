const InputField = ({ 
  id, 
  type = "text",
  placeholder, 
  value = '', 
  onChange,
  onBlur,
  className = "",
  options = [],
  isCertificateDropdown = false,
  checked = false,
  disabled = false,
  isPreferenceValueCheckbox = false,
  min,
  max,
  required = false
}) => {
  // Number input with plus/minus buttons
  if (type === 'number') {
    const handleIncrement = () => {
      if (max === undefined || parseInt(value) < max) {
        onChange({ target: { value: (parseInt(value || '0') + 1).toString() } });
      }
    };

    const handleDecrement = () => {
      if (min === undefined || parseInt(value) > min) {
        onChange({ target: { value: (parseInt(value || '0') - 1).toString() } });
      }
    };

    return (
      <div className="flex items-center justify-end space-x-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || (min !== undefined && parseInt(value || '0') <= min)}
          className={`
            p-1 rounded-lg border border-border bg-primary
            hover:bg-selectedColor hover:foreground transition-colors duration-200
            ${disabled || (min !== undefined && parseInt(value || '0') <= min) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            const newValue = e.target.value.replace(/[^0-9]/g, '');
            if (newValue === '' || (min !== undefined && parseInt(newValue) < min) || (max !== undefined && parseInt(newValue) > max)) {
              return;
            }
            onChange({ target: { value: newValue } });
          }}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`
            w-16 text-center bg-primary text-sm border border-border 
            p-2 rounded-lg text-primary-foreground
            focus:outline-none focus:ring-2 focus:ring-selectedColor
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || (max !== undefined && parseInt(value || '0') >= max)}
          className={`
            p-1 rounded-lg border border-border bg-primary
            hover:bg-selectedColor hover:foreground transition-colors duration-200
            ${disabled || (max !== undefined && parseInt(value || '0') >= max) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  // Certificate dropdown select input
  if (type === 'select') {
    return (
      <div className="relative w-full">
        <select 
          className={`
            ${isCertificateDropdown ? 'cert-select' : ''} 
            dropdown w-full bg-primary text-sm border border-border 
            p-2 pl-3 pr-10 rounded-lg cursor-pointer appearance-none 
            focus:outline-none focus:ring-2 focus:ring-selectedColor focus:border-selectedColor 
            transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          name={id}
          id={id}
          disabled={disabled}
          required={required}
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
      </div>
    );
  }

  // Value checkbox with SVG icons for preferences
  if (type === 'checkbox' && isPreferenceValueCheckbox) {
    return (
      <div className="relative">
        <input 
          type="checkbox"
          className="peer appearance-none w-4 h-4 bg-transparent border-2 border-transparent rounded cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          checked={checked}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
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

  // Default text/password input
  return (
    <div className="relative w-full">
      <input 
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        className={`
          w-full bg-primary text-sm border border-border 
          p-2 rounded-lg cursor-pointer text-primary-foreground 
          placeholder-textSecondary
          focus:outline-none focus:ring-2 focus:ring-selectedColor 
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      />
    </div>
  );
};

export default InputField; 