"use client"

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Input } from '@/components/shared/ui/shadcn/input';
import { Label } from "@/components/shared/ui/shadcn/label";
import { Switch } from '@/components/shared/ui/shadcn/switch';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Separator } from "@/components/shared/ui/shadcn/separator";
import { HelpIconTooltip } from '../shared/ui/shadcn/tooltip/HelpIconTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import { useCertificateValidation, useBatchValidation } from './hooks/useCertificateValidation';
import { Trash2, PlusCircle, Wand2, Eye, EyeOff, Check } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "../shared/ui/shadcn/toast/use-toast";

// Types
interface CertField {
  name: string;
  isAdmin: boolean;
  group: string;
  password: string;
  isEnrollment: boolean;
}

interface BatchCertificateData {
  mode: 'batch';
  name: string;
  group: string;
  count: number;
  prefixType: 'numeric' | 'alpha';
  isAdmin: boolean;
  includeGroupInName: boolean;
  startAt: string | number;
  isEnrollment: boolean;
  certificates?: Array<{
    username: string;
    groups: string[];
    is_admin: boolean;
    password?: string;
    is_enrollment: boolean;
  }>;
}

interface SingleCertificateData {
  mode: 'single';
  certificates: Array<{
    username: string;
    groups: string[];
    is_admin: boolean;
    password?: string;
    is_enrollment: boolean;
  }>;
}

type CertificateData = BatchCertificateData | SingleCertificateData;

type Operation = 'create_single' | 'create_batch' | null;

// Helper function for batch mode
const generateAlphabeticSequence = (start: string, count: number): string[] => {
  const sequence: string[] = [];
  const startChar = start.toLowerCase();
  
  // Convert a string like 'a' or 'aa' to a number
  const stringToNumber = (str: string): number => {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 26 + (str.charCodeAt(i) - 97);
    }
    return num;
  };

  // Convert a number to a string like 'a' or 'aa'
  const numberToString = (num: number): string => {
    let str = '';
    do {
      str = String.fromCharCode(97 + (num % 26)) + str;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    return str;
  };

  const startNum = stringToNumber(startChar);
  
  for (let i = 0; i < count; i++) {
    sequence.push(numberToString(startNum + i));
  }
  
  return sequence;
};

const CreateCertificates: React.FC = () => {
  const [isBatchMode, setIsBatchMode] = useState(() => {
    // Retrieve the mode from session storage or default to false
    return sessionStorage.getItem('certificateMode') === 'batch';
  });
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState<{ [key: number]: boolean }>({});

  // Single certificate state
  const [certFields, setCertFields] = useState([{
    name: '',
    group: '__ANON__',
    password: '',
    isAdmin: false,
    isEnrollment: false
  }]);

  // Batch certificate state
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState<'numeric' | 'alpha'>('numeric');
  const [startAt, setStartAt] = useState<string>('1');
  const [batchEnrollment, setBatchEnrollment] = useState(false);
  const [batchPassword, setBatchPassword] = useState('');
  const [batchPasswordVisible, setBatchPasswordVisible] = useState(false);

  // Update startAt when prefix type changes
  useEffect(() => {
    setStartAt(prefixType === 'numeric' ? '1' : 'a');
  }, [prefixType]);

  // Update session storage whenever the mode changes
  useEffect(() => {
    sessionStorage.setItem('certificateMode', isBatchMode ? 'batch' : 'single');
  }, [isBatchMode]);

  // Handle startAt increment/decrement
  const handleStartAtChange = (increment: boolean) => {
    if (prefixType === 'numeric') {
      const currentValue = parseInt(startAt, 10);
      setStartAt((increment ? currentValue + 1 : Math.max(1, currentValue - 1)).toString());
    } else {
      const currentValue = startAt.toLowerCase();
      if (increment) {
        // Handle increment for alphabetic
        if (currentValue === 'z') {
          setStartAt('aa');
        } else if (currentValue.endsWith('z')) {
          const prefix = currentValue.slice(0, -1);
          const nextChar = String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
          setStartAt(prefix.slice(0, -1) + nextChar + 'a');
        } else {
          const lastChar = currentValue.charAt(currentValue.length - 1);
          setStartAt(currentValue.slice(0, -1) + String.fromCharCode(lastChar.charCodeAt(0) + 1));
        }
      } else {
        // Handle decrement for alphabetic
        if (currentValue === 'a') {
          return; // Don't go below 'a'
        } else if (currentValue.endsWith('a')) {
          const prefix = currentValue.slice(0, -1);
          if (prefix === 'a') {
            setStartAt('z');
          } else {
            const prevChar = String.fromCharCode(prefix.charCodeAt(prefix.length - 1) - 1);
            setStartAt(prefix.slice(0, -1) + prevChar + 'z');
          }
        } else {
          const lastChar = currentValue.charAt(currentValue.length - 1);
          setStartAt(currentValue.slice(0, -1) + String.fromCharCode(lastChar.charCodeAt(0) - 1));
        }
      }
    }
  };

  // Validations
  const certFieldsValidation = useCertificateValidation(certFields, []);
  const batchValidation = useBatchValidation(batchName, batchGroup, []);

  // State to track the number of created certificates
  const [createdCount, setCreatedCount] = useState<number | null>(null);

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
      // Require password for enrollment
      if (batchEnrollment && !batchPassword) return true;
      return false;
    } else {
      // In single mode, require at least one certificate with a name
      const hasValidCert = certFields.some(field => {
        // If there's a name, check validation
        if (field.name) {
          const validation = certFieldsValidation[certFields.indexOf(field)];
          // If this is an enrollment certificate, password is required
          if (field.isEnrollment && !field.password) return false;
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
  }, [isOperationInProgress, isBatchMode, batchName, batchValidation, certFields, certFieldsValidation, batchEnrollment, batchPassword]);

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  // Certificate preview for batch mode
  const getCertificatePreview = () => {
    if (!isBatchMode || !batchName) return null;

    const previewCount = Math.min(count, 5);
    const suffixes = prefixType === 'alpha' 
      ? generateAlphabeticSequence(startAt as string, previewCount)
      : Array.from({ length: previewCount }, (_, i) => (parseInt(startAt as string) + i).toString());

    const primaryGroup = batchGroup.split(',')[0].trim() || '__ANON__';
    
    const preview = suffixes.map(suffix => `${batchName}-${primaryGroup}-${suffix}`);
    if (count > 5) {
      preview.push('...');
    }
    return preview.join(', ');
  };

  // Handlers
  const handleAddCertField = () => {
    setCertFields([...certFields, { name: '', isAdmin: false, group: '__ANON__', password: '', isEnrollment: false }]);
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
    const certificateNames: string[] = [];

    if (isBatchMode) {
      const groups = batchGroup
        .split(',')
        .map(g => g.trim())
        .filter(g => g);
      
      // Generate certificate names based on prefix type and start value
      const certificates = Array.from({ length: count }, (_, index) => {
        let suffix: string;
        
        if (prefixType === 'alpha') {
          const startChar = (startAt as string).toLowerCase();
          const sequences = generateAlphabeticSequence(startChar, count);
          suffix = sequences[index];
        } else {
          // Numeric sequence
          const startNum = parseInt(startAt as string, 10);
          suffix = (startNum + index).toString();
        }

        const primaryGroup = groups.length ? groups[0] : '__ANON__';
        const username = `${batchName.trim()}-${primaryGroup}-${suffix}`;
        certificateNames.push(username);

        return {
          username,
          groups: groups.length ? [groups[0]] : ['__ANON__'],
          is_admin: false,
          password: batchEnrollment ? batchPassword : undefined,
          is_enrollment: batchEnrollment
        };
      });

      return {
        mode: 'batch',
        name: batchName.trim(),
        group: groups.length ? groups[0] : '__ANON__',
        count,
        prefixType,
        isAdmin: false,
        includeGroupInName: true,
        startAt,
        isEnrollment: batchEnrollment,
        certificates
      };
    } else {
      const certificates = certFields
        .filter(field => field.name.trim())
        .map(field => {
          certificateNames.push(field.name.trim()); // Collect certificate names
          return {
            username: field.name.trim(),
            groups: field.group
              ? field.group.split(',').map(g => g.trim()).filter(g => g)
              : ['__ANON__'],
            is_admin: field.isAdmin,
            password: field.password || undefined,
            is_enrollment: field.isEnrollment
          };
        });

      return {
        mode: 'single',
        certificates
      };
    }
  };

  // Handle certificate creation
  const handleOperation = async (operation: Operation) => {
    try {
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
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create certificate(s)')
      }

      // Parse the response
      const result = await response.json();
      
      // Define proper type for certificate details
      type CertDetail = {
        username: string;
        success: boolean;
        message: string;
      };
      
      // Reset form on success
      if (data.mode === 'single') {
        setCertFields([{
          name: '',
          group: '__ANON__',
          password: '',
          isAdmin: false,
          isEnrollment: false
        }]); // Reset to initial state
      }

      // Get certificate count from the result
      const completedCount = result.completed || 0;
      const failedCount = result.failed || 0;
      
      // Set the created count only for successfully created certificates
      setCreatedCount(completedCount);

      // Generate detailed message based on result
      if (!result.success) {
        // Show partial success or failure message
        if (completedCount > 0) {
          // Some certificates were created successfully
          const successDetails = (result.details as CertDetail[])
            ?.filter((detail: CertDetail) => detail.success)
            .map((detail: CertDetail) => detail.username)
            .join(', ');
            
          const failDetails = (result.details as CertDetail[])
            ?.filter((detail: CertDetail) => !detail.success)
            .map((detail: CertDetail) => `${detail.username} (${detail.message})`)
            .join(', ');
            
          toast({
            title: "Partial Success",
            description: `Created ${completedCount} certificate(s) successfully: ${successDetails}. Failed to create ${failedCount} certificate(s): ${failDetails}. Restart the TAK server for new certificates to take effect.`,
            variant: 'destructive'
          });
        } else {
          // All certificates failed to create
          const failDetails = (result.details as CertDetail[])
            ?.map((detail: CertDetail) => `${detail.username} (${detail.message})`)
            .join(', ');
            
          toast({
            title: "Failed to Create Certificates",
            description: result.message || `All certificates failed to create: ${failDetails}`,
            variant: 'destructive'
          });
        }
      } else {
        // All certificates created successfully
        const certificateNames = (result.details as CertDetail[])
          ?.map((detail: CertDetail) => detail.username)
          .join(', ');
          
        toast({
          title: "Certificates Created",
          description: `Successfully created ${completedCount} certificate(s): ${certificateNames}. Restart the TAK server for new certificates to take effect.`,
          variant: 'success'
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Operation failed',
        variant: 'destructive', // Adjust the variant as needed
      });
    } finally {
      // Reset loading state and current operation
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      
      // Reset created count after a short delay
      setTimeout(() => {
        setCreatedCount(null);
      }, 1000); // Adjust the delay as needed
    }
  };

  const handleSingleCreate = () => handleOperation('create_single');
  const handleBatchCreate = () => handleOperation('create_batch');

  const generateSecurePassword = () => {
    const length = 15;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!+-:,.';
    
    let password = '';
    
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest with random characters
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const togglePasswordVisibility = (index: number) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleGeneratePassword = (index: number) => {
    const newPassword = generateSecurePassword();
    handleCertFieldChange(index, 'password', newPassword); // Ensure state is updated correctly
  };

  return (
    <Card className="w-full max-w-6xl mx-auto break-normal">
      <CardHeader>
        <CardTitle>Certificate Creation</CardTitle>
        <CardDescription>Create single or batch certificates for TAK users</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          {/* Mode Switch */}
          <div className="flex items-center space-x-4">
            <Label htmlFor="batch-mode" className="flex items-center">
              <span>Mode: {isBatchMode ? 'Batch' : 'Single'}</span>
              <HelpIconTooltip 
                tooltip="Switch between single and batch certificate creation"
                triggerMode="hover"
                className='pl-2'
              />
            </Label>
            <div>
              <Switch
                id="batch-mode"
                checked={isBatchMode}
                onCheckedChange={setIsBatchMode}
              />
            </div>
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                      <Label htmlFor={`group-${index}`} className="flex items-center gap-2 break-normal">
                        Groups
                        <HelpIconTooltip 
                          tooltip="Comma-separated list of groups. Leave as __ANON__ for default group. Example: Group1,Group2"
                          triggerMode="hover"
                          iconSize={14}
                        />
                      </Label>
                      <Input
                        id={`group-${index}`}
                        value={field.group}
                        onChange={(e) => handleCertFieldChange(index, 'group', e.target.value)}
                        onBlur={() => handleBlur(`group${index}`)}
                        className={cn(
                          "w-fit",
                          // displayErrors[`group${index}`] && "border-red-500"
                        )}
                      />
                    </div>
                    
                    {/* Password field */}
                    <div className="space-y-2">
                      <Label htmlFor={`password-${index}`} className="flex items-center gap-2 break-normal">
                        Password for Enrollment {field.isEnrollment ? '(Required)' : '(Optional)'}
                        <HelpIconTooltip 
                          tooltip={field.isEnrollment 
                            ? "Password is required for enrollment users to authenticate to the TAK server." 
                            : "Optional password for certificate enrollment. Enter if you prefer to use a password over uploading the certificate manually to ATAK."}
                          triggerMode="hover"
                          iconSize={14}
                        />
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Input
                            type={passwordVisibility[index] ? "text" : "password"}
                            id={`password-${index}`}
                            value={field.password}
                            onChange={(e) => handleCertFieldChange(index, 'password', e.target.value)}
                            onBlur={() => handleBlur(`password${index}`)}
                            placeholder="Enter password"
                            required={field.isEnrollment}
                            className={cn(
                              "w-full pr-10",
                              field.isEnrollment && !field.password && "border-red-500"
                            )}
                          />
                          <Button
                            type="button"
                            onClick={() => togglePasswordVisibility(index)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground hover:text-primary"
                            tooltip="Show/Hide password"
                            triggerMode="hover"
                          >
                            {passwordVisibility[index] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleGeneratePassword(index)}
                          className="h-10 w-10 shrink-0"
                          tooltip="Generate secure password"
                          triggerMode="hover"
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Admin and Enrollment switches stacked */}
                    <div className="space-y-3 flex flex-col justify-center">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`admin-${index}`}
                          checked={field.isAdmin}
                          onCheckedChange={(checked) => handleCertFieldChange(index, 'isAdmin', checked)}
                        />
                        <Label htmlFor={`admin-${index}`}>Admin Status</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`enrollment-${index}`}
                          checked={field.isEnrollment}
                          onCheckedChange={(checked) => handleCertFieldChange(index, 'isEnrollment', checked)}
                        />
                        <Label htmlFor={`enrollment-${index}`} className="flex items-center gap-2">
                          Enrollment User
                          <HelpIconTooltip 
                            tooltip="Enable this for users who will enroll to get their certificate from the TAK server instead of being provided with one."
                            triggerMode="hover"
                            iconSize={14}
                          />
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleAddCertField}
                variant="outline"
                size="icon"
                className="ml-2 block"
                type="button"
                tooltip="Add Certificate"
                triggerMode="hover"
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
                  <Label htmlFor="batchGroup" className="flex items-center gap-2">
                    Groups
                    <HelpIconTooltip 
                      tooltip="Comma-separated list of groups. Leave as __ANON__ for no group. Example: Group1,Group2"
                      triggerMode="hover"
                      iconSize={14}
                    />
                  </Label>
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
                <div className="space-y-2">
                  <Label htmlFor="startAt" className="flex items-center gap-2">
                    Start At
                    <HelpIconTooltip 
                      tooltip={prefixType === 'numeric' ? 
                        "Starting number for certificate sequence" : 
                        "Starting letter(s) for certificate sequence (a-z, aa-zz, etc)"
                      }
                      triggerMode="hover"
                      iconSize={14}
                    />
                  </Label>
                  <Input
                    id="startAt"
                    value={startAt}
                    onChange={(e) => {
                      let value = e.target.value.toLowerCase();
                      if (prefixType === 'numeric') {
                        // Only allow positive numbers
                        const num = parseInt(value, 10);
                        if (!isNaN(num) && num > 0) {
                          setStartAt(num.toString());
                        }
                      } else {
                        // Only allow alphabetic characters
                        if (/^[a-z]+$/.test(value)) {
                          setStartAt(value);
                        }
                      }
                    }}
                    onUpDown={handleStartAtChange}
                    type={prefixType === 'numeric' ? 'number' : 'text'}
                    min={prefixType === 'numeric' ? 1 : undefined}
                    className="w-fit"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="batchEnrollment"
                    checked={batchEnrollment}
                    onCheckedChange={setBatchEnrollment}
                  />
                  <Label htmlFor="batchEnrollment" className="flex items-center gap-2">
                    Enrollment Users
                    <HelpIconTooltip 
                      tooltip="Enable this for batch users who will enroll to get their certificate from the TAK server instead of being provided with one."
                      triggerMode="hover"
                      iconSize={14}
                    />
                  </Label>
                </div>
                
                {/* Add password field for batch enrollment */}
                {batchEnrollment && (
                  <div className="space-y-2">
                    <Label htmlFor="batchPassword" className="flex items-center gap-2 break-normal">
                      Password for Enrollment
                      <HelpIconTooltip 
                        tooltip="Password is required for enrollment users. This will be set for all users in the batch."
                        triggerMode="hover"
                        iconSize={14}
                      />
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Input
                          type={batchPasswordVisible ? "text" : "password"}
                          id="batchPassword"
                          value={batchPassword}
                          onChange={(e) => setBatchPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full pr-10"
                          required={batchEnrollment}
                        />
                        <Button
                          type="button"
                          onClick={() => setBatchPasswordVisible(!batchPasswordVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground hover:text-primary"
                          tooltip="Show/Hide password"
                          triggerMode="hover"
                        >
                          {batchPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setBatchPassword(generateSecurePassword())}
                        className="h-10 w-10 shrink-0"
                        tooltip="Generate secure password"
                        triggerMode="hover"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {getCertificatePreview() && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Preview: {getCertificatePreview()}
                </div>
              )}
            </div>
          )}

          {/* Create Button */}
          <div className="flex justify-end mt-6 break-normal">
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
                      {createdCount ? (
                        <span className="flex items-center gap-2">
                          <Check className="mr-2 text-green-500" />
                          {`Created ${createdCount} Certificate${createdCount > 1 ? 's' : ''}`}
                        </span>
                      ) : (
                        `Create Certificate${(isBatchMode || certFields.length > 1) ? 's' : ''}`
                      )}
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