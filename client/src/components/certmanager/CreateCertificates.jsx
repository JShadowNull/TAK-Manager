import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '../shared/ui/shadcn/input';
import useFetch from '../shared/hooks/useFetch';
import { Switch } from '../shared/ui/shadcn/switch';
import { Button } from '../shared/ui/shadcn/button';
import { HelpIconTooltip } from '../shared/ui/shadcn/tooltip/HelpIconTooltip';
import LoadingButton from '../shared/ui/inputs/LoadingButton';
import { useCertificateValidation, useBatchValidation } from './hooks/useCertificateValidation';

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

function CreateCertificates({ onOperationProgress, isConnected }) {
  const [buttonState, setButtonState] = useState('idle');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [certFields, setCertFields] = useState([
    { name: '', isAdmin: false, group: '__ANON__', password: '' }
  ]);
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState('numeric');
  const [operationProgress, setOperationProgress] = useState({
    total: 0,
    completed: 0,
    currentCert: '',
    step: '',
    message: '',
    progress: 0
  });
  const [existingCertificates, setExistingCertificates] = useState([]);

  const { post, get } = useFetch();

  // Fetch existing certificates on mount
  useEffect(() => {
    const fetchExistingCertificates = async () => {
      try {
        const response = await get('/certmanager/certmanager/list');
        if (response?.certificates) {
          setExistingCertificates(response.certificates.map(cert => cert.name));
        }
      } catch (error) {
        console.error('Error fetching certificates:', error);
      }
    };
    fetchExistingCertificates();
  }, []);

  // Validate single mode certificates
  const certFieldsValidation = useCertificateValidation(certFields, existingCertificates);

  // Validate batch mode
  const batchValidation = useBatchValidation(batchName, batchGroup, existingCertificates);

  const isCreateButtonDisabled = useMemo(() => {
    if (buttonState !== 'idle') return true;
    if (!isConnected) return true;
    
    if (isBatchMode) {
      return !batchValidation.isValid || !batchName.trim() || count < 1;
    } else {
      return certFields.some((field, index) => {
        if (!field.name.trim()) return true;
        return !certFieldsValidation[index].isValid;
      });
    }
  }, [buttonState, isConnected, isBatchMode, batchValidation, batchName, count, certFields, certFieldsValidation]);

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  // Debug connection status
  useEffect(() => {
    console.log('Socket connection status:', isConnected);
  }, [isConnected]);

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

  const formatCertificateData = () => {
    if (isBatchMode) {
      const groups = batchGroup
        .split(',')
        .map(g => g.trim())
        .filter(g => g);
      
      return {
        mode: 'batch',
        name: batchName.trim(),
        group: groups.length ? groups[0] : '__ANON__',
        count: parseInt(count, 10),
        prefixType,
        isAdmin: false,
        includeGroupInName: true
      };
    } else {
      return {
        mode: 'single',
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

  // Handle operation status updates from WebSocket
  useEffect(() => {
    if (typeof onOperationProgress === 'function') {
      const data = onOperationProgress();
      if (data?.operation === 'certificate_operation') {
        // Update progress based on socket events
        setOperationProgress(prev => ({
          ...prev,
          completed: data.details?.completed_certs || 0,
          total: data.details?.total_certs || prev.total,
          currentCert: data.details?.current_cert?.username || '',
          step: data.details?.current_cert?.step || '',
          stepProgress: data.details?.current_cert?.step_progress || 0,
          message: data.message || '',
          progress: data.progress || 0
        }));

        // Handle completion
        if (data.status === 'complete') {
          setButtonState('complete');
          setTimeout(() => {
            setButtonState('idle');
            setOperationProgress({
              total: 0,
              completed: 0,
              currentCert: '',
              step: '',
              message: '',
              progress: 0
            });
            // Reset form if successful
            if (isBatchMode) {
              setBatchName('');
              setBatchGroup('__ANON__');
              setCount(1);
            } else {
              setCertFields([{ name: '', isAdmin: false, group: '__ANON__', password: '' }]);
            }
          }, 1000);
        } else if (data.status === 'failed') {
          setButtonState('failed');
          setOperationProgress(prev => ({
            ...prev,
            message: data.message || 'Failed to create certificates',
            progress: 0
          }));
        }
      }
    }
  }, [onOperationProgress, isBatchMode]);

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
      // Set initial loading state immediately
      setButtonState('loading');
      setOperationProgress({
        total: isBatchMode ? data.count : data.certificates.length,
        completed: 0,
        currentCert: '',
        step: 'Initializing',
        message: `Starting certificate creation`,
        progress: 0
      });

      const response = await post('/certmanager/certmanager/create', data);
      
      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to create certificates');
      }

      console.log('Certificate creation initiated:', response);
      
    } catch (error) {
      console.error('Error creating certificates:', error);
      setButtonState('failed');
      setOperationProgress(prev => ({
        ...prev,
        message: error.message || 'Failed to create certificates',
        progress: 0
      }));
      
      // Reset state after error
      setTimeout(() => {
        setButtonState('idle');
        setOperationProgress({
          total: 0,
          completed: 0,
          currentCert: '',
          step: '',
          message: '',
          progress: 0
        });
      }, 3000);
    }
  };

  return (
    <div className="border border-border bg-card p-2 md:p-4 rounded-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 mb-4">
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
          <div className="flex items-center space-x-2">
            <Switch
              id="batch-mode"
              checked={isBatchMode}
              onCheckedChange={setIsBatchMode}
              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-primary"
              aria-label="Toggle batch mode"
            />
            <label
              htmlFor="batch-mode"
              className="text-sm font-medium text-primary cursor-pointer select-none"
            >
              Batch Generation
            </label>
          </div>
        </div>

        {/* Single/Custom Mode - Create one or more custom certificates */}
        {!isBatchMode && certFields.map((field, index) => {
          const validation = certFieldsValidation[index];
          return (
            <div key={index} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
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
                  value={field.name}
                  onChange={(e) => handleCertFieldChange(index, 'name', e.target.value)}
                  placeholder="Enter certificate name"
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
                {validation?.errors?.name && (
                  <p className="mt-1 text-sm text-red-500">{validation.errors.name}</p>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
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
                  value={field.group}
                  onChange={(e) => handleCertFieldChange(index, 'group', e.target.value)}
                  placeholder="Enter group names (comma-separated)"
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
                {validation?.errors?.group && (
                  <p className="mt-1 text-sm text-red-500">{validation.errors.group}</p>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Login Password (Optional)
                    <HelpIconTooltip 
                      tooltip="Optional password for certificate authentication"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <Input
                  type="password"
                  id={`password-${index}`}
                  value={field.password || ''}
                  onChange={(e) => handleCertFieldChange(index, 'password', e.target.value)}
                  placeholder="Enter password"
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
                {validation?.errors?.password && (
                  <p className="mt-1 text-sm text-red-500">{validation.errors.password}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`admin-${index}`}
                    checked={field.isAdmin}
                    onCheckedChange={(checked) => handleCertFieldChange(index, 'isAdmin', checked)}
                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-primary"
                    aria-label={`Toggle admin mode for certificate ${index + 1}`}
                  />
                  <label
                    htmlFor={`admin-${index}`}
                    className="text-sm font-medium text-primary cursor-pointer select-none"
                  >
                    Admin
                  </label>
                </div>
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
          );
        })}

        {/* Batch Generation Mode - Create multiple certificates with standard naming */}
        {isBatchMode && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Base Name
                    <HelpIconTooltip 
                      tooltip="The prefix used for all generated certificates (e.g. 'user')"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <Input
                  type="text"
                  id="batchName"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Enter base name (e.g. jake)"
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
                {batchValidation.errors.name && (
                  <p className="mt-1 text-sm text-red-500">{batchValidation.errors.name}</p>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Groups
                    <HelpIconTooltip 
                      tooltip="The groups all certificates will belong to (separate multiple groups with commas)"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <Input
                  type="text"
                  id="batchGroup"
                  value={batchGroup}
                  onChange={(e) => setBatchGroup(e.target.value)}
                  placeholder="Enter group names (comma-separated)"
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
                {batchValidation.errors.group && (
                  <p className="mt-1 text-sm text-red-500">{batchValidation.errors.group}</p>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Suffix Type
                    <HelpIconTooltip 
                      tooltip="How to number the certificates (e.g. 1,2,3 or a,b,c)"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <Input
                  type="select"
                  id="prefixType"
                  value={prefixType}
                  onChange={(e) => setPrefixType(e.target.value)}
                  options={prefixOptions}
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="text-sm text-primary font-medium flex items-center gap-1">
                    Number of Certificates
                    <HelpIconTooltip 
                      tooltip="How many certificates to generate in this batch"
                      triggerMode="hover"
                    />
                  </span>
                </div>
                <Input
                  type="number"
                  id="count"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10))}
                  min={1}
                  className="flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background"
                />
              </div>
            </div>
            
            {/* Certificate Name Preview */}
            <div className="text-sm text-primary italic break-words">
              Preview: {getCertificatePreview()}
            </div>
          </div>
        )}

        {/* Create Button with LoadingButton component */}
        <div>
          <LoadingButton
            operation="configure"
            isLoading={buttonState === 'loading'}
            status={buttonState === 'idle' ? null : buttonState}
            disabled={isCreateButtonDisabled}
            showProgress={true}
            progressType="percentage"
            progress={operationProgress.progress || 0}
            message={buttonState === 'loading' ? 
              `${operationProgress.message || `Creating certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`} (${operationProgress.completed}/${operationProgress.total})${operationProgress.currentCert ? ` - ${operationProgress.currentCert}` : ''}${operationProgress.step ? ` (${operationProgress.step}${operationProgress.stepProgress ? ` - ${operationProgress.stepProgress}%` : ''})` : ''}` 
              : undefined}
            loadingMessage={`Creating certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`}
            successMessage={operationProgress.message || "Certificates created successfully"}
            failedMessage={operationProgress.message || "Failed to create certificates"}
            onClick={handleCreateCertificates}
            variant="primary"
            className="w-full md:w-auto hover:bg-green-500"
          >
            {`Create Certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

export default CreateCertificates; 