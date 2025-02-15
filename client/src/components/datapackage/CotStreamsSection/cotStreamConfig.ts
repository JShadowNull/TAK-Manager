import { z } from 'zod';
import { takServerSchema } from '../shared/validationSchemas';

export interface CotStreamItem {
  name: string;
  label: string;
  input_type: 'text' | 'select' | 'number' | 'password';
  value?: string;
  defaultValue?: string;
  options?: Array<{ value: string; text: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  isCertificateDropdown?: boolean;
}

export const generateCotStreamItems = (count: number): CotStreamItem[] => {
  const baseItems: CotStreamItem[] = [{
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
        name: `Name for TAK Server`,
        label: `description${i}`,
        input_type: "text",
        placeholder: "My-Server-Name",
        required: true
      },
      {
        name: `IP address of TAK Server`,
        label: `ipAddress${i}`,
        input_type: "text",
        placeholder: "192.168.1.20",
        required: true
      },
      {
        name: `Port of TAK Server`,
        label: `port${i}`,
        input_type: "number",
        placeholder: "8089",
        min: 1,
        max: 65535,
        required: true
      },
      {
        name: `Protocol of TAK Server`,
        label: `protocol${i}`,
        input_type: "select",
        options: [
          { value: "ssl", text: "SSL" },
          { value: "tcp", text: "TCP" }
        ],
        placeholder: "Select protocol",
        required: true
      },
      {
        name: `CA certificate for TAK Server`,
        label: `caLocation${i}`,
        input_type: "select",
        options: [],
        placeholder: "Select CA certificate",
        isCertificateDropdown: true,
        required: true
      },
      {
        name: `Certificate password`,
        label: `certPassword${i}`,
        input_type: "password",
        placeholder: "atakatak",
        required: true
      }
    );
  }
  return baseItems;
};

export const validateCotStreams = (preferences: Record<string, { value: string; enabled?: boolean }>) => {
  const errors: Record<string, string> = {};
  const count = parseInt(preferences.count?.value || "1", 10);

  for (let i = 0; i < count; i++) {
    // Get all values, ensuring empty strings for undefined values
    const description = preferences[`description${i}`]?.value ?? "";
    const ipAddress = preferences[`ipAddress${i}`]?.value ?? "";
    const portStr = preferences[`port${i}`]?.value ?? "";
    const protocol = preferences[`protocol${i}`]?.value ?? "";
    const caLocation = preferences[`caLocation${i}`]?.value ?? "";
    const certPassword = preferences[`certPassword${i}`]?.value ?? "";

    // Debug logging
    console.debug('[validateCotStreams] Stream data before validation:', {
      index: i,
      description,
      ipAddress,
      portStr,
      protocol,
      caLocation,
      certPassword
    });

    // Convert port to number, ensuring 0 for invalid values
    const port = parseInt(portStr) || 0;

    const streamData = {
      description,
      ipAddress,
      port,
      protocol,
      caLocation,
      certPassword
    };

    try {
      console.debug('[validateCotStreams] Attempting validation for stream:', i, streamData);
      takServerSchema.parse(streamData);
      console.debug('[validateCotStreams] Validation successful for stream:', i);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.debug('[validateCotStreams] Validation errors:', error.errors);
        error.errors.forEach(err => {
          const field = err.path[0] as string;
          errors[`${field}${i}`] = err.message;
        });
      }
    }
  }

  console.debug('[validateCotStreams] Final validation errors:', errors);
  return errors;
}; 