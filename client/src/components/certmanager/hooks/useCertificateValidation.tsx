import { useMemo } from 'react';

interface ValidationErrors {
  name?: string;
  group?: string;
  password?: string;
}

interface ValidationState {
  errors: ValidationErrors;
  isValid: boolean;
}

// Pure validation functions
const validateCertificateName = (name: string, existingCertificates: string[] = []): string | null => {
  if (!name) return null;
  if (existingCertificates.includes(name)) return 'Certificate name already exists';
  if (name.includes(' ')) return 'Spaces are not allowed';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return 'Only alphanumeric characters, underscores, and hyphens are allowed';
  return null;
};

const validateGroupName = (group: string): string | null => {
  if (!group) return null;
  const groupNames = group.split(',').map(g => g.trim());
  
  if (group.includes(' ')) return 'Spaces are not allowed in group names';
  if (groupNames.some(g => !/^[a-zA-Z0-9_-]+$/.test(g))) {
    return 'Groups can only contain letters, numbers, underscores, and hyphens';
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return null;
  
  const requirements = [
    { test: (p: string) => p.length >= 15, message: 'Must be at least 15 characters' },
    { test: (p: string) => /[A-Z]/.test(p), message: 'Must contain at least 1 uppercase letter' },
    { test: (p: string) => /[a-z]/.test(p), message: 'Must contain at least 1 lowercase letter' },
    { test: (p: string) => /[0-9]/.test(p), message: 'Must contain at least 1 number' },
    { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(p), message: 'Must contain at least 1 special character' }
  ];

  const failedRequirements = requirements
    .filter(req => !req.test(password))
    .map(req => req.message);

  return failedRequirements.length > 0 ? failedRequirements.join(', ') : null;
};

export const validateCertificateField = (
  name: string,
  group: string,
  password: string | undefined,
  existingCertificates: string[] = []
): ValidationState => {
  const errors: ValidationErrors = {};
  
  const nameError = validateCertificateName(name, existingCertificates);
  const groupError = validateGroupName(group);
  const passwordError = password ? validatePassword(password) : null;

  if (nameError) errors.name = nameError;
  if (groupError) errors.group = groupError;
  if (passwordError) errors.password = passwordError;

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Batch validation
export const validateBatchName = (name: string, existingCertificates: string[] = []): string | null => {
  if (!name) return 'Name is required';
  return validateCertificateName(name, existingCertificates);
};

export const validateBatchGroup = (group: string): string | null => {
  if (!group) return null;
  return validateGroupName(group);
};

// Custom hook for certificate validation
export const useCertificateValidation = (certFields: Array<{
  name: string;
  group: string;
  password?: string;
}>, existingCertificates: string[] = []) => {
  return useMemo(() => {
    return certFields.map(field => 
      validateCertificateField(field.name, field.group, field.password, existingCertificates)
    );
  }, [certFields, existingCertificates]);
};

// Custom hook for batch validation
export const useBatchValidation = (batchName: string, batchGroup: string, existingCertificates: string[] = []) => {
  return useMemo(() => {
    const nameError = validateBatchName(batchName, existingCertificates);
    const groupError = validateBatchGroup(batchGroup);
    
    return {
      errors: {
        name: nameError,
        group: groupError
      },
      isValid: !nameError && !groupError
    };
  }, [batchName, batchGroup, existingCertificates]); 
}; 