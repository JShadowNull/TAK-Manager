import React, { useEffect } from 'react';
import PreferenceItem from './PreferenceItem';

// Validation rules for CoT stream fields
const validateCotStream = (streamIndex, preferences) => {
  const errors = {};
  const prefix = streamIndex === -1 ? '' : `${streamIndex}`;
  
  // Only validate enabled streams
  const isEnabled = preferences[`enabled${prefix}`]?.value;
  if (!isEnabled) return errors;

  // Required fields when stream is enabled
  const requiredFields = [
    { key: `connectString${prefix}`, message: 'Connection string is required' },
    { key: `certificateLocation${prefix}`, message: 'Client certificate is required' }
  ];

  // Check required fields
  requiredFields.forEach(({ key, message }) => {
    const value = preferences[key]?.value;
    if (!value || value.trim() === '') {
      errors[key] = message;
    }
  });

  // Validate connection string format (IP:Port:Protocol)
  const connectString = preferences[`connectString${prefix}`]?.value;
  if (connectString && connectString.trim() !== '') {
    const parts = connectString.split(':');
    if (parts.length !== 3) {
      errors[`connectString${prefix}`] = 'Connection string must be in format IP:Port:Protocol';
    } else {
      const [ip, port, protocol] = parts;
      if (!ip || !port || !protocol) {
        errors[`connectString${prefix}`] = 'Invalid connection string format';
      }
      if (protocol.toLowerCase() !== 'ssl' && protocol.toLowerCase() !== 'tls') {
        errors[`connectString${prefix}`] = 'Protocol must be SSL or TLS';
      }
    }
  }

  return errors;
};

export const generateCotStreamItems = (count) => {
  const baseItems = [{
    name: "Number of CoT (Cursor on Target) streams configured",
    label: "count",
    input_type: "number",
    value: count.toString(),
    min: 1,
    max: 10,
    required: true
  }];

  for (let i = 0; i < count; i++) {
    baseItems.push(
      {
        name: `Description of CoT stream ${i + 1}`,
        label: `description${i}`,
        input_type: "text",
        value: "My-Server-Name",
        enabled: true,
        required: true
      },
      {
        name: `Whether CoT stream ${i + 1} is enabled`,
        label: `enabled${i}`,
        input_type: "checkbox",
        checked: true,
        enabled: true,
        required: true
      },
      {
        name: `Connection string for CoT stream ${i + 1} (IP:Port:Protocol)`,
        label: `connectString${i}`,
        input_type: "text",
        value: "192.168.1.20:8089:ssl",
        enabled: true,
        required: true,
      },
      {
        name: `Path to the CA certificate for CoT stream ${i + 1}`,
        label: `caLocation${i}`,
        input_type: "select",
        options: [],
        value: "",
        isCertificateDropdown: true,
        enabled: true,
        required: true
      },
      {
        name: `Path to the client certificate for CoT stream ${i + 1}`,
        label: `certificateLocation${i}`,
        input_type: "select",
        options: [],
        value: "",
        isCertificateDropdown: true,
        enabled: true,
        required: true
      },
      {
        name: `Password for the client certificate for CoT stream ${i + 1} (Default: atakatak)`, 
        label: `clientPassword${i}`,
        input_type: "password",
        value: "atakatak",
        enabled: true,
        required: true
      },
      {
        name: `Password for the CA certificate for CoT stream ${i + 1} (Default: atakatak)`,
        label: `caPassword${i}`,
        input_type: "password",
        value: "atakatak",
        enabled: true,
        required: true
      }
    );
  }
  return baseItems;
};

// Export default items for backward compatibility
export const COT_STREAM_ITEMS = generateCotStreamItems(1);

function CotStreams({ preferences, onPreferenceChange, onEnableChange, onValidationChange }) {
  const count = parseInt(preferences.count?.value || "1", 10);
  const items = generateCotStreamItems(count);

  // Validate all streams whenever preferences change
  useEffect(() => {
    let allErrors = {};
    
    // Validate each stream
    for (let i = 0; i < count; i++) {
      const streamErrors = validateCotStream(i, preferences);
      allErrors = { ...allErrors, ...streamErrors };
    }

    // Report validation errors
    if (onValidationChange) {
      onValidationChange('cot_streams', allErrors);
    }
  }, [preferences, count, onValidationChange]);

  // Get certificate options from any of the certificate fields
  const getCertificateOptions = () => {
    const certField = Object.entries(preferences).find(([key, pref]) => 
      (key.includes('caLocation') || key.includes('certificateLocation')) && 
      Array.isArray(pref.options)
    );
    return certField ? certField[1].options : [];
  };

  const certOptions = getCertificateOptions();

  return (
    <div className="divide-y divide-accentBoarder w-full p-4">
      {items.map((item) => {
        const isCertLocationField = item.label.toLowerCase().includes('location');
        const pref = preferences[item.label] || {};
        
        // Set default enabled state if not already set
        if (pref.enabled === undefined) {
          pref.enabled = item.enabled || false;
        }

        // For certificate fields, ensure options are set
        const fieldOptions = isCertLocationField ? certOptions : item.options || [];

        // Get the current value, using preference value if available
        const fieldValue = pref.value !== undefined ? pref.value : item.value;
        
        // Determine if field is required based on stream enabled state
        const streamIndex = item.label.match(/\d+$/)?.[0];
        const isStreamEnabled = streamIndex !== undefined && 
          preferences[`enabled${streamIndex}`]?.value;
        const isRequired = item.required && isStreamEnabled;
        
        return (
          <div key={item.label} className="py-2 first:pt-0 last:pb-0 w-full">
            <PreferenceItem
              name={item.name}
              label={item.label}
              input_type={isCertLocationField ? 'select' : item.input_type}
              value={fieldValue}
              checked={item.input_type === 'checkbox' ? pref.value : undefined}
              options={fieldOptions}
              isEnabled={pref.enabled}
              required={isRequired}
              placeholder={item.placeholder}
              onChange={(e) => {
                const value = item.input_type === 'checkbox' 
                  ? e.target.checked 
                  : e.target.value;
                onPreferenceChange(item.label, value);
              }}
              onEnableChange={(enabled) => onEnableChange(item.label, enabled)}
              isCertificateDropdown={isCertLocationField}
              min={item.min}
              max={item.max}
            />
          </div>
        );
      })}
    </div>
  );
}

export default CotStreams; 