export const generateCotStreamItems = (count) => {
  const baseItems = [{
    name: "Number of CoT (Cursor on Target) streams configured",
    label: "count",
    input_type: "number",
    value: count.toString(),
    min: 1,
    max: 10,
    required: true,
    enabled: true
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
        value: true,
        enabled: true,
        required: true
      },
      {
        name: `Connection string for CoT stream ${i + 1} (IP:Port:Protocol)`,
        label: `connectString${i}`,
        input_type: "text",
        value: "192.168.1.20:8089:ssl",
        enabled: true,
        required: true
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

// Validation rules for CoT stream fields
export const validateCotStream = (streamIndex, preferences) => {
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