import React, { useRef, useState } from 'react';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled } from '@mui/material/styles';
import InputField from '../InputField';
import { io } from 'socket.io-client';

// Create a styled Switch component using Tailwind-like styles
const StyledSwitch = styled(Switch)({
  '& .MuiSwitch-switchBase': {
    color: '#ffffff',
    '&.Mui-checked': {
      color: '#ffffff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#22C55E',
        opacity: 1,
      },
    },
  },
  '& .MuiSwitch-track': {
    backgroundColor: '#EF4444',
    opacity: 1,
  },
});

// Loading spinner component
const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Checkmark icon component
const CheckmarkIcon = () => (
  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Error icon component
const ErrorIcon = () => (
  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Function to generate alphabetic sequence
const generateAlphabeticSequence = (n) => {
  const sequence = [];
  let len = 1;
  let count = 0;
  
  while (count < n) {
    let str = '';
    let num = count;
    
    for (let i = 0; i < len; i++) {
      str = String.fromCharCode(97 + (num % 26)) + str;
      num = Math.floor(num / 26);
    }
    
    sequence.push(str);
    count++;
    
    if (count === Math.pow(26, len)) {
      len++;
    }
  }
  
  return sequence;
};

function CreateCertificates({ onOperationProgress }) {
  const socketRef = useRef(null);
  const [buttonState, setButtonState] = useState('idle');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [certFields, setCertFields] = useState([
    { name: '', isAdmin: false, group: '__ANON__' }
  ]);
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState('numeric');

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  // Preview for batch generation
  const getCertificatePreview = () => {
    if (!isBatchMode || !batchName) return null;

    const previewCount = Math.min(count, 5);
    const suffixes = prefixType === 'alpha' 
      ? generateAlphabeticSequence(previewCount)
      : Array.from({ length: previewCount }, (_, i) => (i + 1).toString());

    const preview = suffixes.map(suffix => `${batchName}-${batchGroup}-${suffix}`);
    if (count > 5) {
      preview.push('...');
    }
    return preview.join(', ');
  };

  const handleAddCertField = () => {
    setCertFields([...certFields, { name: '', isAdmin: false, group: '__ANON__' }]);
  };

  const handleRemoveCertField = (index) => {
    setCertFields(certFields.filter((_, i) => i !== index));
  };

  const handleCertFieldChange = (index, field, value) => {
    const newFields = [...certFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCertFields(newFields);
  };

  const setupSocket = () => {
    if (!socketRef.current) {
      socketRef.current = io('/cert-manager', {
        transports: ['websocket'],
        reconnection: false
      });
      
      socketRef.current.on('cert_operation', (data) => {
        console.log('Received cert operation:', data);
        
        if (data.type === 'create') {
          if (typeof onOperationProgress === 'function') {
            try {
              onOperationProgress(data);
            } catch (error) {
              console.error('Error in operation progress callback:', error);
            }
          }
          
          switch (data.status) {
            case 'started':
            case 'in_progress':
              // Maintain loading state during operation
              setButtonState('loading');
              break;
              
            case 'completed':
              // Show success state after completion
              setButtonState('success');
              setTimeout(() => {
                setButtonState('idle');
                cleanupSocket();
              }, 3000);
              break;
              
            case 'failed':
              // Show failure state
              setButtonState('failed');
              setTimeout(() => {
                setButtonState('idle');
                cleanupSocket();
              }, 3000);
              break;
              
            default:
              console.warn('Unknown operation status:', data.status);
              // Maintain current state for unknown status
              break;
          }
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setButtonState('failed');
        setTimeout(() => {
          setButtonState('idle');
          cleanupSocket();
        }, 3000);
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
        setButtonState('failed');
        setTimeout(() => {
          setButtonState('idle');
          cleanupSocket();
        }, 3000);
      });
    }
  };

  const cleanupSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
        socketRef.current = null;
      } catch (error) {
        console.error('Error cleaning up socket:', error);
      }
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, []);

  const isCreateButtonDisabled = () => {
    if (buttonState !== 'idle') return true;
    
    if (isBatchMode) {
      // For batch mode, require base name and count
      return !batchName.trim() || count < 1;
    } else {
      // For single/custom mode, require at least one certificate with name
      return certFields.every(field => !field.name.trim());
    }
  };

  const formatCertificateData = () => {
    if (isBatchMode) {
      // For batch mode, send batch parameters directly
      return {
        name: batchName,
        group: batchGroup || '__ANON__',
        prefixType: prefixType,
        count: count,
        isAdmin: false,
        includeGroupInName: true
      };
    } else {
      // For single/custom mode, send array of certificates
      return {
        certificates: certFields
          .filter(field => field.name.trim())
          .map(field => ({
            username: field.name.trim(),
            groups: field.group ? [field.group] : ['__ANON__'],
            is_admin: field.isAdmin
          }))
      };
    }
  };

  const handleCreateCertificates = async () => {
    if (isCreateButtonDisabled()) return;

    const data = formatCertificateData();
    
    if (isBatchMode && !data.name) {
      console.error('No base name provided for batch generation');
      return;
    }
    
    if (!isBatchMode && (!data.certificates || data.certificates.length === 0)) {
      console.error('No valid certificates to create');
      return;
    }

    try {
      setButtonState('loading');
      setupSocket();

      const response = await fetch('/api/certmanager/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      // Keep loading state until we process the response
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Process the response while keeping loading state
      if (!result.success) {
        throw new Error(result.message || 'Failed to create certificates');
      }

      // Only change state after we've confirmed success
      setButtonState('success');
      setTimeout(() => {
        setButtonState('idle');
        cleanupSocket();
      }, 3000);
      
    } catch (error) {
      console.error('Error creating certificates:', error);
      setButtonState('failed');
      setTimeout(() => {
        setButtonState('idle');
        cleanupSocket();
      }, 3000);
    }
  };

  const getButtonContent = () => {
    switch (buttonState) {
      case 'loading':
        return (
          <>
            <LoadingSpinner />
            Creating...
          </>
        );
      case 'success':
        return (
          <>
            <CheckmarkIcon />
            Done
          </>
        );
      case 'failed':
        return (
          <>
            <ErrorIcon />
            Failed
          </>
        );
      default:
        return `Create Certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`;
    }
  };

  return (
    <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-base font-bold">Create Certificates</h3>
        {!isBatchMode && (
          <button
            onClick={handleAddCertField}
            className="text-buttonTextColor p-2 rounded-lg border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-blue-500 transition-all duration-200"
            title="Add Certificate"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-4">
        {/* Mode Switch */}
        <div className="flex gap-4 items-center">
          <FormControlLabel
            control={
              <StyledSwitch
                checked={isBatchMode}
                onChange={(e) => setIsBatchMode(e.target.checked)}
              />
            }
            label={
              <span className="text-sm text-white">
                Batch Generation
              </span>
            }
          />
        </div>

        {/* Single/Custom Mode - Create one or more custom certificates */}
        {!isBatchMode && certFields.map((field, index) => (
          <div key={index} className="flex gap-4 items-end">
            <div className="flex-1">
              <InputField
                type="text"
                id={`cert-${index}`}
                label={index === 0 ? "Certificate Name" : `Additional Certificate ${index}`}
                value={field.name}
                onChange={(e) => handleCertFieldChange(index, 'name', e.target.value)}
                placeholder="Enter certificate name"
                className="text-buttonTextColor placeholder-textSecondary"
              />
            </div>
            <div className="flex-1">
              <InputField
                type="text"
                id={`group-${index}`}
                label="Group"
                value={field.group}
                onChange={(e) => handleCertFieldChange(index, 'group', e.target.value)}
                placeholder="Enter group name"
                className="text-buttonTextColor placeholder-textSecondary"
              />
            </div>
            <div className="flex items-center gap-4">
              <FormControlLabel
                control={
                  <StyledSwitch
                    checked={field.isAdmin}
                    onChange={(e) => handleCertFieldChange(index, 'isAdmin', e.target.checked)}
                  />
                }
                label={
                  <span className="text-sm text-white">
                    Admin
                  </span>
                }
              />
              {index > 0 && (
                <button
                  onClick={() => handleRemoveCertField(index)}
                  className="text-red-500 hover:text-red-600 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Batch Generation Mode - Create multiple certificates with standard naming */}
        {isBatchMode && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <InputField
                  type="text"
                  id="batchName"
                  label="Base Name"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Enter base name (e.g. jake)"
                  className="text-buttonTextColor placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="text"
                  id="batchGroup"
                  label="Group"
                  value={batchGroup}
                  onChange={(e) => setBatchGroup(e.target.value)}
                  placeholder="Enter group name"
                  className="text-buttonTextColor placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="select"
                  id="prefixType"
                  label="Suffix Type"
                  value={prefixType}
                  onChange={setPrefixType}
                  options={prefixOptions}
                  className="text-buttonTextColor"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="number"
                  id="count"
                  label="Number of Certificates"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  min={1}
                  className="text-buttonTextColor"
                />
              </div>
            </div>
            
            {/* Certificate Name Preview */}
            <div className="text-sm text-gray-400 italic">
              Preview: {getCertificatePreview()}
            </div>
          </div>
        )}

        {/* Create Button */}
        <button
          className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:shadow-md hover:border-black transition-all duration-200 flex items-center justify-center ${
            buttonState === 'success' ? 'bg-green-500' : 
            buttonState === 'failed' ? 'bg-red-500' :
            buttonState === 'loading' ? 'opacity-75 cursor-not-allowed' : 
            'hover:bg-green-500'
          }`}
          onClick={handleCreateCertificates}
          disabled={isCreateButtonDisabled()}
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
}

export default CreateCertificates; 