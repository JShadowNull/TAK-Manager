import { z } from 'zod';
import { useCallback } from 'react';

// Updated password validation with excluded characters
export const passwordSchema = z.string()
  .optional()
  .refine(
    (pass) => {
      if (!pass) return true; // Allow empty password
      return pass.length >= 15;
    },
    { message: 'Must be at least 15 characters' }
  )
  .refine(
    (pass) => {
      if (!pass) return true;
      return /[A-Z]/.test(pass);
    },
    { message: 'Must contain at least 1 uppercase letter' }
  )
  .refine(
    (pass) => {
      if (!pass) return true;
      return /[a-z]/.test(pass);
    },
    { message: 'Must contain at least 1 lowercase letter' }
  )
  .refine(
    (pass) => {
      if (!pass) return true;
      return /[0-9]/.test(pass);
    },
    { message: 'Must contain at least 1 number' }
  )
  .refine(
    (pass) => {
      if (!pass) return true;
      // Updated special characters with excluded list
      return /[!$+\-:,.<>|]/.test(pass);
    },
    { 
      message: 'Must contain at least 1 allowed special character (! $ + - : , . < > |)' 
    }
  )
  .refine(
    (pass) => {
      if (!pass) return true;
      // Validate against excluded characters
      return !/[="'&%^*?¨´`/@[\]{}();_#]/.test(pass);
    },
    {
      message: 'Contains invalid characters: = " \' & % ^ * ? ¨ ´ ` / \\ @ [ ] { } ( ) ; _ #'
    }
  );

// Group validation
export const groupSchema = z.string()
  .refine(
    (group) => {
      if (!group || group === '__ANON__') return true;
      // Split by comma and check each group
      const groups = group.split(',');
      // Check for spaces after comma and valid characters
      return groups.every(g => {
        if (g.length === 0) return false; // Empty group not allowed
        if (g !== g.trim()) return false; // No spaces allowed at start/end
        return /^[a-zA-Z0-9_-]+$/.test(g);
      });
    },
    { message: 'Groups must be comma-separated with no spaces, using only letters, numbers, underscores, and hyphens' }
  )
  .transform(str => str === '' ? '__ANON__' : str);

// Certificate validation schema
export const certificateSchema = z.object({
  name: z.string()
    .refine(
      (name) => {
        if (!name) return true; // Allow empty name
        return name.length >= 3;
      },
      { message: "Certificate name must be at least 3 characters" }
    )
    .refine(
      (name) => {
        if (!name) return true;
        return /^[a-zA-Z0-9-_]+$/.test(name);
      },
      { message: "Only letters, numbers, hyphens and underscores are allowed" }
    ),
  group: groupSchema,
  password: passwordSchema,
  isAdmin: z.boolean()
});

// Batch certificate validation schema
export const batchCertificateSchema = z.object({
  name: z.string()
    .min(3, "Base name must be at least 3 characters")
    .regex(/^[a-zA-Z0-9-_]+$/, "Only letters, numbers, hyphens and underscores are allowed")
    .nonempty("Base name is required"),
  group: groupSchema
});

export const useCertificateValidation = (certFields: Array<{
  name: string;
  group: string;
  password?: string;
  isAdmin: boolean;
}>, existingCertificates: string[]) => {
  const validateField = useCallback((field: {
    name: string;
    group: string;
    password?: string;
    isAdmin: boolean;
  }) => {
    try {
      // Skip validation if fields are empty (except for batch mode)
      if (!field.name && !field.password && (!field.group || field.group === '__ANON__')) {
        return { isValid: true, errors: {} };
      }

      // First validate against schema
      certificateSchema.parse(field);

      // Then check for duplicate names only if name is not empty
      if (field.name && existingCertificates.includes(field.name)) {
        return {
          isValid: false,
          errors: {
            name: "Certificate name already exists"
          }
        };
      }

      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.reduce((acc, curr) => {
          const field = curr.path[0] as string;
          acc[field] = curr.message;
          return acc;
        }, {} as Record<string, string>);

        return {
          isValid: false,
          errors
        };
      }
      return {
        isValid: false,
        errors: {
          name: "Invalid certificate data"
        }
      };
    }
  }, [existingCertificates]);

  return certFields.map(validateField);
};

export const useBatchValidation = (batchName: string, batchGroup: string, existingCertificates: string[]) => {
  const validate = useCallback(() => {
    try {
      // Skip validation if fields are empty
      if (!batchName && (!batchGroup || batchGroup === '__ANON__')) {
        return { isValid: true, errors: {} };
      }

      // First validate against schema
      batchCertificateSchema.parse({ name: batchName, group: batchGroup });

      // Then check for potential name conflicts
      if (batchName && existingCertificates.some(cert => cert.startsWith(batchName))) {
        return {
          isValid: false,
          errors: {
            name: "Certificate names with this base name may conflict with existing certificates"
          }
        };
      }

      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.reduce((acc, curr) => {
          const field = curr.path[0] as string;
          acc[field] = curr.message;
          return acc;
        }, {} as Record<string, string>);

        return {
          isValid: false,
          errors
        };
      }
      return {
        isValid: false,
        errors: {
          name: "Invalid batch certificate data"
        }
      };
    }
  }, [batchName, batchGroup, existingCertificates]);

  return validate();
}; 