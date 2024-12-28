import { z } from "zod";
import { UseSocketReturn } from "../../shared/hooks/useSocket";

// Form schema for TAK Server installation
export const formSchema = z.object({
  docker_zip_file: z.instanceof(File, { message: "Docker ZIP file is required" })
    .refine((file) => file.name.endsWith('.zip'), "File must be a ZIP file")
    .refine(
      (file) => file.size <= 5000000000, // 5GB max
      "File size must be less than 5GB"
    ),
  postgres_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  certificate_password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  organization: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Organization name can only contain letters, numbers, spaces, hyphens, underscores, and periods"
    ),
  state: z.string()
    .min(2, "State/Province must be at least 2 characters")
    .max(50, "State/Province must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "State/Province can only contain letters, spaces, hyphens, and apostrophes"
    ),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City must be less than 50 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "City can only contain letters, spaces, hyphens, and apostrophes"
    ),
  organizational_unit: z.string()
    .min(2, "Organizational unit must be at least 2 characters")
    .max(100, "Organizational unit must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Organizational unit can only contain letters, numbers, spaces, hyphens, underscores, and periods"
    ),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(
      /^[a-zA-Z\s\-']+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
});

// TypeScript types
export type FormData = z.infer<typeof formSchema>;

// Socket event types
export interface SocketEventData {
  isInstalled: boolean;
  isRunning: boolean;
  dockerRunning: boolean;
  version?: string;
  error?: string;
  status?: string;
  operationInProgress: boolean;
  isStarting?: boolean;
  isStopping?: boolean;
  isRestarting?: boolean;
}

export interface InstallState {
  isInstalling: boolean;
  installationComplete: boolean;
  installationSuccess: boolean;
  installationError: string | undefined;
  error?: string | undefined;
  isRollingBack: boolean;
  isStoppingInstallation: boolean;
  status: string | undefined;
  operationInProgress: boolean;
  dockerInstalled: boolean;
  progress: number;
}

export interface UninstallState {
  isUninstalling: boolean;
  uninstallComplete: boolean;
  uninstallSuccess: boolean;
  uninstallError: string | undefined;
  status: string | undefined;
  operationInProgress: boolean;
  progress: number;
}

export interface InstallationFormProps {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export interface FormState {
  docker_zip_file: File | null;
  postgres_password: string;
  certificate_password: string;
  organization: string;
  state: string;
  city: string;
  organizational_unit: string;
  name: string;
  installation_id: string | null;
}

export interface TakServerStatusProps {
  socket: UseSocketReturn;
} 