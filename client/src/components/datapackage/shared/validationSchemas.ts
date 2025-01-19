import { z } from "zod";

// Zip name validation schema
export const zipNameSchema = z.string()
  .min(3, "Zip file name must be at least 3 characters")
  .regex(/^[a-zA-Z0-9-_]+$/, "Only letters, numbers, hyphens and underscores are allowed")
  .refine(name => !name.includes('.zip'), "Do not include .zip extension");

// TAK Server validation schema
export const takServerSchema = z.object({
  description: z.string()
    .min(3, "Server name must be at least 3 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Only letters, numbers, and hyphens are allowed")
    .nonempty("Server name is required"),
  ipAddress: z.string()
    .ip("Must be a valid IP address")
    .nonempty("IP address is required"),
  port: z.number()
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535"),
  protocol: z.enum(["ssl", "tcp"], {
    required_error: "Protocol is required",
    invalid_type_error: "Protocol must be either SSL or TCP"
  }),
  caLocation: z.string()
    .nonempty("CA certificate is required"),
  certPassword: z.string()
    .min(8, "Certificate password must be at least 8 characters")
    .nonempty("Certificate password is required")
});

// ATAK Preference validation schema
export const atakPreferenceSchema = z.object({
  value: z.string(),
  enabled: z.boolean(),
  input_type: z.enum(["text", "select", "number", "password"]),
  options: z.array(z.object({
    value: z.string(),
    text: z.string()
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional()
}).refine(data => {
  // If preference is enabled, value must not be empty
  if (data.enabled && !data.value.trim()) {
    return false;
  }

  // If preference is enabled and it's a number type, validate number range
  if (data.enabled && data.input_type === "number") {
    const num = Number(data.value);
    if (isNaN(num)) return false;
    if (data.min !== undefined && num < data.min) return false;
    if (data.max !== undefined && num > data.max) return false;
  }

  // If preference is enabled and it's a select type, validate option exists
  if (data.enabled && data.input_type === "select" && data.options) {
    if (!data.options.some(opt => opt.value === data.value)) {
      return false;
    }
  }

  return true;
}, {
  message: "Value is required when preference is enabled"
});

// Bulk generation validation schema
export const bulkGenerationSchema = z.object({
  certificates: z.array(z.object({
    value: z.string(),
    label: z.string()
  })),
  fileNames: z.record(z.string(), z.string().regex(/^[a-zA-Z0-9-_]+$/, "Only letters, numbers, hyphens and underscores are allowed"))
}); 