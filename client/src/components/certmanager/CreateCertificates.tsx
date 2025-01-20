"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from "@/components/shared/ui/shadcn/label";
import { Switch } from '@/components/shared/ui/shadcn/switch';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Separator } from "@/components/shared/ui/shadcn/separator";
import { HelpIconTooltip } from '../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import { useCertificateValidation, useBatchValidation } from './hooks/useCertificateValidation';
import { Trash2, PlusCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

// Types
interface CertField {
  name: string;
  isAdmin: boolean;
  group: string;
  password: string;
}

interface OperationProgress {
  total: number;
  completed: number;
  currentCert: string;
  step: string;
  message: string;
  progress: number;
  stepProgress?: number;
}

interface CreateCertificatesProps {
  onOperationProgress?: (data: OperationProgress) => void;
}

interface BatchCertificateData {
  mode: 'batch';
  name: string;
  group: string;
  count: number;
  prefixType: 'numeric' | 'alpha';
  isAdmin: boolean;
  includeGroupInName: boolean;
}

interface SingleCertificateData {
  mode: 'single';
  certificates: Array<{
    username: string;
    groups: string[];
    is_admin: boolean;
    password?: string;
  }>;
}

type CertificateData = BatchCertificateData | SingleCertificateData;

type Operation = 'create_single' | 'create_batch' | null;

// Helper function for batch mode
const generateAlphabeticSequence = (n: number): string[] => {
  const sequence: string[] = [];
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

const CreateCertificates: React.FC<CreateCertificatesProps> = ({ onOperationProgress }) => {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<any>(null);

  // Single certificate state
  const [certFields, setCertFields] = useState([{
    name: '',
    group: '__ANON__',
    password: '',
    isAdmin: false
  }]);

  // Batch certificate state
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState<'numeric' | 'alpha'>('numeric');

  // Validations
  const certFieldsValidation = useCertificateValidation(certFields, []);
  const batchValidation = useBatchValidation(batchName, batchGroup, []);

  const handleBlur = useCallback((field: string) => {
    // Validate immediately on blur
    const newErrors: Record<string, string> = {};
    
    if (isBatchMode) {
      if (field === 'batchName' && batchValidation.errors.name) {
        newErrors['batchName'] = batchValidation.errors.name;
      }
      if (field === 'batchGroup' && batchValidation.errors.group) {
        newErrors['batchGroup'] = batchValidation.errors.group;
      }
    } else {
      const index = parseInt(field.replace(/[^0-9]/g, ''), 10);
      const fieldName = field.replace(/[0-9]/g, '');
      const validation = certFieldsValidation[index];
      if (validation?.errors[fieldName]) {
        newErrors[field] = validation.errors[fieldName];
      } else {
        delete newErrors[field];
      }
    }
    
    // setDisplayErrors(newErrors);
  }, [isBatchMode, batchValidation, certFieldsValidation]);

  const isCreateButtonDisabled = useMemo(() => {
    if (isOperationInProgress) return true;
    
    if (isBatchMode) {
      // In batch mode, require name but maintain validation behavior
      if (!batchName) return true;
      if (!batchValidation.isValid) return true;
      return false;
    } else {
      // In single mode, require at least one certificate with a name
      const hasValidCert = certFields.some(field => {
        // If there's a name, check validation
        if (field.name) {
          const validation = certFieldsValidation[certFields.indexOf(field)];
          return validation.isValid;
        }
        return false;
      });
      
      // If no certificates have names, disable button
      const hasAnyCertWithName = certFields.some(field => field.name);
      if (!hasAnyCertWithName) return true;
      
      // If we have certs with names but none are valid, disable button
      return !hasValidCert;
    }
  }, [isOperationInProgress, isBatchMode, batchName, batchValidation, certFields, certFieldsValidation]);

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  // Certificate preview for batch mode
  const getCertificatePreview = () => {
    if (!isBatchMode || !batchName) return null;

    const previewCount = Math.min(count, 5);
    const suffixes = prefixType === 'alpha' 
      ? generateAlphabeticSequence(previewCount)
      : Array.from({ length: previewCount }, (_, i) => (i + 1).toString());

    const primaryGroup = batchGroup.split(',')[0].trim() || '__ANON__';
    
    const preview = suffixes.map(suffix => `${batchName}-${primaryGroup}-${suffix}`);
    if (count > 5) {
      preview.push('...');
    }
    return preview.join(', ');
  };

  // Handlers
  const handleAddCertField = () => {
    setCertFields([...certFields, { name: '', isAdmin: false, group: '__ANON__', password: '' }]);
  };

  const handleRemoveCertField = (index: number) => {
    setCertFields(certFields.filter((_, i) => i !== index));
  };

  const handleCertFieldChange = (index: number, field: keyof CertField, value: string | boolean) => {
    const newFields = [...certFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCertFields(newFields);
  };

  const formatCertificateData = (): CertificateData => {
    if (isBatchMode) {
      const groups = batchGroup
        .split(',')
        .map(g => g.trim())
        .filter(g => g);
      
      return {
        mode: 'batch',
        name: batchName.trim(),
        group: groups.length ? groups[0] : '__ANON__',
        count,
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

  // Handle certificate creation
  const handleOperation = async (operation: Operation) => {
    try {
      setError(null);
      setCurrentOperation(operation);
      setIsOperationInProgress(true);

      const endpoint = '/api/certmanager/certificates/create';
      const data = formatCertificateData();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to create certificate(s)');
      }

      // Reset form on success will be handled by SSE complete event
    } catch (error) {
      console.error('Operation error:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleSingleCreate = () => handleOperation('create_single');
  const handleBatchCreate = () => handleOperation('create_batch');

  // Setup SSE for creation status updates
  useEffect(() => {
    const eventSource = new EventSource('/api/certmanager/certificates/status-stream');

    eventSource.addEventListener('certificate-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === 'complete' || data.status === 'error') {
          setIsOperationInProgress(false);
          setCurrentOperation(null);
          if (data.error) {
            setError(data.error);
          } else {
            setError(null);
            // Reset form on success
            if (isBatchMode) {
              setBatchName('');
              setBatchGroup('__ANON__');
              setCount(1);
              setPrefixType('numeric');
            } else {
              setCertFields([{
                name: '',
                group: '__ANON__',
                password: '',
                isAdmin: false
              }]);
            }
          }
        }
        
        setOperationStatus(data);
        // Call onOperationProgress with the status data
        if (onOperationProgress && data.type === 'status') {
          const progress: OperationProgress = {
            total: data.details?.total || 0,
            completed: data.details?.completed || 0,
            currentCert: data.details?.username || '',
            step: data.operation || '',
            message: data.message || '',
            progress: data.details?.completed ? (data.details.completed / data.details.total) * 100 : 0,
            stepProgress: data.details?.stepProgress
          };
          onOperationProgress(progress);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        setIsOperationInProgress(false);
        setCurrentOperation(null);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [isBatchMode, onOperationProgress]);

  const isCreating = operationStatus?.operation?.includes('create_certs') && 
                    ['in_progress'].includes(operationStatus?.status);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Certificate Creation</CardTitle>
        <CardDescription>Create single or batch certificates for TAK users</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          {/* Mode Switch */}
          <div className="flex items-center space-x-4">
            <Label htmlFor="batch-mode" className="flex items-center space-x-2">
              <span>Mode: {isBatchMode ? 'Batch' : 'Single'}</span>
              <HelpIconTooltip 
                tooltip="Switch between single and batch certificate creation"
                triggerMode="hover"
              />
            </Label>
            <Switch
              id="batch-mode"
              checked={isBatchMode}
              onCheckedChange={setIsBatchMode}
            />
          </div>

          <Separator />

          {/* Single Certificate Mode */}
          {!isBatchMode && (
            <div className="space-y-6">
              {certFields.map((field, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <CardTitle className="text-lg">Certificate {index + 1}</CardTitle>
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCertField(index)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`cert-${index}`}>Certificate Name</Label>
                      <Input
                        id={`cert-${index}`}
                        value={field.name}
                        onChange={(e) => handleCertFieldChange(index, 'name', e.target.value)}
                        onBlur={() => handleBlur(`name${index}`)}
                        placeholder="Enter name"
                        className={cn(
                          "w-fit",
                          // displayErrors[`name${index}`] && "border-red-500"
                        )}
                      />
                      {/* {displayErrors[`name${index}`] && (
                        <p className="text-sm text-red-500 font-medium">{displayErrors[`name${index}`]}</p>
                      )} */}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`group-${index}`}>Groups</Label>
                      <Input
                        id={`group-${index}`}
                        value={field.group}
                        onChange={(e) => handleCertFieldChange(index, 'group', e.target.value)}
                        onBlur={() => handleBlur(`group${index}`)}
                        placeholder="Enter groups"
                        className={cn(
                          "w-fit",
                          // displayErrors[`group${index}`] && "border-red-500"
                        )}
                      />
                      {/* {displayErrors[`group${index}`] && (
                        <p className="text-sm text-red-500 font-medium">{displayErrors[`group${index}`]}</p>
                      )} */}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`password-${index}`}>Password (Optional)</Label>
                      <Input
                        type="password"
                        id={`password-${index}`}
                        value={field.password}
                        onChange={(e) => handleCertFieldChange(index, 'password', e.target.value)}
                        onBlur={() => handleBlur(`password${index}`)}
                        placeholder="Enter password"
                        className={cn(
                          "w-fit",
                          // displayErrors[`password${index}`] && "border-red-500"
                        )}
                      />
                      {/* {displayErrors[`password${index}`] && (
                        <p className="text-sm text-red-500 font-medium">{displayErrors[`password${index}`]}</p>
                      )} */}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`admin-${index}`}
                        checked={field.isAdmin}
                        onCheckedChange={(checked) => handleCertFieldChange(index, 'isAdmin', checked)}
                      />
                      <Label htmlFor={`admin-${index}`}>Admin Status</Label>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleAddCertField}
                variant="outline"
                size="icon"
                className="ml-auto block"
                type="button"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Add Certificate</span>
              </Button>
            </div>
          )}

          {/* Batch Mode */}
          {isBatchMode && (
            <div className="p-4 border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="batchName">Base Name</Label>
                  <Input
                    id="batchName"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    onBlur={() => handleBlur('batchName')}
                    placeholder="Enter base name"
                    className={cn(
                      "w-fit",
                      // displayErrors.batchName && "border-red-500"
                    )}
                  />
                  {/* {displayErrors.batchName && (
                    <p className="text-sm text-red-500 font-medium">{displayErrors.batchName}</p>
                  )} */}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchGroup">Groups</Label>
                  <Input
                    id="batchGroup"
                    value={batchGroup}
                    onChange={(e) => setBatchGroup(e.target.value)}
                    onBlur={() => handleBlur('batchGroup')}
                    placeholder="Enter groups"
                    className={cn(
                      "w-fit",
                      // displayErrors.batchGroup && "border-red-500"
                    )}
                  />
                  {/* {displayErrors.batchGroup && (
                    <p className="text-sm text-red-500 font-medium">{displayErrors.batchGroup}</p>
                  )} */}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefixType">Suffix Type</Label>
                  <Input
                    type="select"
                    id="prefixType"
                    value={prefixType}
                    onChange={(e) => setPrefixType(e.target.value as 'numeric' | 'alpha')}
                    options={prefixOptions}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="count">Number of Certificates</Label>
                  <Input
                    type="number"
                    id="count"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    min={1}
                  />
                </div>
              </div>
              {getCertificatePreview() && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Preview: {getCertificatePreview()}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive mb-2">{error}</p>
          )}

          {/* Create Button */}
          <div className="flex justify-end mt-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={isBatchMode ? handleBatchCreate : handleSingleCreate}
                      disabled={isCreateButtonDisabled || isOperationInProgress}
                      loading={currentOperation !== null}
                      loadingText={`Creating certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`}
                    >
                      {`Create Certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`}
                    </Button>
                  </div>
                </TooltipTrigger>
                {(isCreateButtonDisabled || isOperationInProgress) && (
                  <TooltipContent className="max-w-[300px]">
                    <div className="space-y-2">
                      {isBatchMode ? (
                        <div>
                          {(!batchName || batchValidation.errors.name) && (
                            <div>
                              <p className="font-semibold">Base Name Error:</p>
                              <p className="text-sm">{batchValidation.errors.name || "Base name is required"}</p>
                            </div>
                          )}
                          {batchValidation.errors.group && (
                            <div>
                              <p className="font-semibold">Group Error:</p>
                              <p className="text-sm">{batchValidation.errors.group}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {certFields.map((field, index) => {
                            const validation = certFieldsValidation[index];
                            const hasContent = field.name || field.password || (field.group && field.group !== '__ANON__');
                            const showError = !field.name || (hasContent && !validation.isValid);
                            
                            if (showError) {
                              return (
                                <div key={index}>
                                  <p className="font-semibold">Certificate {index + 1} Errors:</p>
                                  <ul className="list-disc pl-4">
                                    {!field.name && (
                                      <li key="name" className="text-sm">
                                        Name: Certificate name is required
                                      </li>
                                    )}
                                    {hasContent && Object.entries(validation.errors).map(([field, error]) => (
                                      <li key={field} className="text-sm">
                                        {field.charAt(0).toUpperCase() + field.slice(1)}: {error}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      {isOperationInProgress && (
                        <div>
                          <p className="font-semibold">Operation in Progress</p>
                          <p className="text-sm">Please wait while the certificates are being created...</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateCertificates;