import React, { useState } from 'react';
import { Input } from '../shared/ui/shadcn/input';
import useSocket from '../shared/hooks/useSocket';
import StyledSwitch from '../shared/ui/StyledSwitch';
import { Button } from '../shared/ui/shadcn/button';
import { HelpIconTooltip } from '../shared/ui/shadcn/tooltip/HelpIconTooltip';

// Checkmark icon component
const CheckmarkIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Error icon component
const ErrorIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Add icon component
const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

// Delete icon component
const DeleteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
  const [buttonState, setButtonState] = useState('idle');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [certFields, setCertFields] = useState([
    { name: '', isAdmin: false, group: '__ANON__', password: '' }
  ]);
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState('numeric');
  const [completedCerts, setCompletedCerts] = useState(0);
  const [expectedCerts, setExpectedCerts] = useState(0);

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  // Socket event handlers
  const eventHandlers = {
    cert_operation: (data) => {
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
            setButtonState('loading');
            break;
            
          case 'in_progress':
            // Keep loading state, do nothing
            break;
            
          case 'completed':
            // For single certificate creation
            if (!isBatchMode) {
              setButtonState('success');
              setTimeout(() => {
                setCertFields([{ name: '', isAdmin: false, group: '__ANON__', password: '' }]);
                setButtonState('idle');
              }, 3000);
            }
            break;

          case 'batch_completed':
            // For batch completion
            setButtonState('success');
            setTimeout(() => {
              setBatchName('');
              setBatchGroup('__ANON__');
              setCount(1);
              setButtonState('idle');
            }, 3000);
            break;
            
          case 'failed':
            setButtonState('failed');
            setTimeout(() => {
              setButtonState('idle');
            }, 3000);
            break;
            
          default:
            console.warn('Unknown operation status:', data.status);
            break;
        }
      }
    },
    onError: (error) => {
      console.error('Socket error:', error);
      setButtonState('failed');
      setTimeout(() => setButtonState('idle'), 3000);
    }
  };

  // Initialize socket with useSocket hook
  const { isConnected } = useSocket('/cert-manager', {
    eventHandlers,
    autoConnect: false // Only connect when needed
  });

  // Preview for batch generation
  const getCertificatePreview = () => {
    if (!isBatchMode || !batchName) return null;

    const previewCount = Math.min(count, 5);
    const suffixes = prefixType === 'alpha' 
      ? generateAlphabeticSequence(previewCount)
      : Array.from({ length: previewCount }, (_, i) => (i + 1).toString());

    // Use the first group for the preview if multiple groups are specified
    const primaryGroup = batchGroup.split(',')[0].trim() || '__ANON__';
    
    const preview = suffixes.map(suffix => `${batchName}-${primaryGroup}-${suffix}`);
    if (count > 5) {
      preview.push('...');
    }
    return preview.join(', ');
  };

  const handleAddCertField = () => {
    setCertFields([...certFields, { name: '', isAdmin: false, group: '__ANON__', password: '' }]);
  };

  const handleRemoveCertField = (index) => {
    setCertFields(certFields.filter((_, i) => i !== index));
  };

  const handleCertFieldChange = (index, field, value) => {
    const newFields = [...certFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCertFields(newFields);
  };

  const isCreateButtonDisabled = () => {
    if (buttonState !== 'idle') return true;
    
    if (isBatchMode) {
      return !batchName.trim() || count < 1;
    } else {
      return certFields.every(field => !field.name.trim());
    }
  };

  const formatCertificateData = () => {
    if (isBatchMode) {
      const groups = batchGroup
        .split(',')
        .map(g => g.trim())
        .filter(g => g);
      
      return {
        name: batchName.trim(),
        group: groups.length ? groups[0] : '__ANON__', // Send single group for batch mode
        count: parseInt(count, 10),
        prefixType,
        isAdmin: false,
        includeGroupInName: true
      };
    } else {
      return {
        certificates: certFields
          .filter(field => field.name.trim())
          .map(field => ({
            username: field.name.trim(),
            groups: field.group
              ? field.group.split(',').map(g => g.trim()).filter(g => g)
              : ['__ANON__'],
            is_admin: field.isAdmin,
            password: field.password || undefined
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
      setCompletedCerts(0);
      // Set expected number of certificates
      setExpectedCerts(isBatchMode ? data.count : data.certificates.length);

      const response = await fetch('/certmanager/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.message !== "Operation initiated successfully") {
        setButtonState('failed');
        setTimeout(() => {
          setButtonState('idle');
          setCompletedCerts(0);
          setExpectedCerts(0);
        }, 3000);
      }
      // Don't set any button state here for success case, let socket events handle it
      
    } catch (error) {
      console.error('Error creating certificates:', error);
      setButtonState('failed');
      setTimeout(() => {
        setButtonState('idle');
        setCompletedCerts(0);
        setExpectedCerts(0);
      }, 3000);
    }
  };

  return (
    <div className="border border-border bg-card p-4 rounded-lg">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-base font-bold">Create Certificates</h3>
        {!isBatchMode && (
          <Button
            onClick={handleAddCertField}
            tooltip="Add Certificate"
            iconOnly
            leadingIcon={<AddIcon />}
          />
        )}
      </div>
      <div className="space-y-4">
        {/* Mode Switch */}
        <div className="flex gap-4 items-center">
          <StyledSwitch
            checked={isBatchMode}
            onChange={(e) => setIsBatchMode(e.target.checked)}
            label="Batch Generation"
          />
        </div>

        {/* Single/Custom Mode - Create one or more custom certificates */}
        {!isBatchMode && certFields.map((field, index) => (
          <div key={index} className="flex gap-4 items-end">
            <div className="flex-1">
              <div className="mb-2">
                <span className="text-sm text-primary-foreground font-medium flex items-center">
                  Certificate Name
                  <HelpIconTooltip 
                    tooltip="The unique identifier for this certificate"
                    triggerMode="hover"
                  />
                </span>
              </div>
              <Input
                type="text"
                id={`cert-${index}`}
                label={index === 0 ? "Certificate Name" : `Additional Certificate ${index}`}
                value={field.name}
                onChange={(e) => handleCertFieldChange(index, 'name', e.target.value)}
                placeholder="Enter certificate name"
                className="text-primary-foreground placeholder-textSecondary"
              />
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <span className="text-sm text-primary-foreground font-medium flex items-center">
                  Groups
                  <HelpIconTooltip 
                    tooltip="The groups this certificate belongs to (separate multiple groups with commas)"
                    triggerMode="hover"
                  />
                </span>
              </div>
              <Input
                type="text"
                id={`group-${index}`}
                label="Groups"
                value={field.group}
                onChange={(e) => handleCertFieldChange(index, 'group', e.target.value)}
                placeholder="Enter group names (comma-separated)"
                className="text-primary-foreground placeholder-textSecondary"
              />
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <span className="text-sm text-primary-foreground font-medium flex items-center">
                  Login Password (Optional)
                  <HelpIconTooltip 
                    tooltip="Optional password for certificate authentication"
                    triggerMode="hover"
                  />
                </span>
              </div>
              <InputField
                type="password"
                id={`password-${index}`}
                label="Password (Optional)"
                value={field.password || ''}
                onChange={(e) => handleCertFieldChange(index, 'password', e.target.value)}
                placeholder="Enter password"
                className="text-primary-foreground placeholder-textSecondary"
              />
            </div>
            <div className="flex items-center gap-4 mt-8">
              <StyledSwitch
                checked={field.isAdmin}
                onChange={(e) => handleCertFieldChange(index, 'isAdmin', e.target.checked)}
                label="Admin"
              />
              {index > 0 && (
                <Button
                  onClick={() => handleRemoveCertField(index)}
                  variant="danger"
                  iconOnly
                  leadingIcon={<DeleteIcon />}
                />
              )}
            </div>
          </div>
        ))}

        {/* Batch Generation Mode - Create multiple certificates with standard naming */}
        {isBatchMode && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary-foreground font-medium flex items-center">
                    Base Name
                    <HelpIconTooltip 
                      tooltip="The prefix used for all generated certificates (e.g. 'user')"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <InputField
                  type="text"
                  id="batchName"
                  label="Base Name"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Enter base name (e.g. jake)"
                  className="text-primary-foreground placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary-foreground font-medium flex items-center">
                    Groups
                    <HelpIconTooltip 
                      tooltip="The groups all certificates will belong to (separate multiple groups with commas)"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <InputField
                  type="text"
                  id="batchGroup"
                  label="Groups"
                  value={batchGroup}
                  onChange={(e) => setBatchGroup(e.target.value)}
                  placeholder="Enter group names (comma-separated)"
                  className="text-primary-foreground placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary-foreground font-medium flex items-center">
                    Suffix Type
                    <HelpIconTooltip 
                      tooltip="How to number the certificates (e.g. 1,2,3 or a,b,c)"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <InputField
                  type="select"
                  id="prefixType"
                  label="Suffix Type"
                  value={prefixType}
                  onChange={setPrefixType}
                  options={prefixOptions}
                  className="text-primary-foreground"
                />
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary-foreground font-medium flex items-center">
                    Number of Certificates
                    <HelpIconTooltip 
                      tooltip="How many certificates to generate in this batch"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <InputField
                  type="number"
                  id="count"
                  label="Number of Certificates"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  min={1}
                  className="text-primary-foreground"
                />
              </div>
            </div>
            
            {/* Certificate Name Preview */}
            <div className="text-sm text-textSecondary italic">
              Preview: {getCertificatePreview()}
            </div>
          </div>
        )}

        {/* Create Button */}
        <Button
          onClick={handleCreateCertificates}
          disabled={isCreateButtonDisabled() || buttonState === 'loading'}
          loading={buttonState === 'loading'}
          loadingText="Creating..."
          variant="primary"
          className={`hover:bg-green-500 ${
            buttonState === 'success' ? 'bg-green-500 !opacity-100' : 
            buttonState === 'failed' ? 'bg-red-500 hover:bg-red-500 !opacity-100' : ''
          }`}
          leadingIcon={
            buttonState === 'success' ? <CheckmarkIcon /> :
            buttonState === 'failed' ? <ErrorIcon /> :
            null
          }
        >
          {buttonState === 'success' ? 'Done' :
           buttonState === 'failed' ? 'Failed' :
           `Create Certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

export default CreateCertificates; 