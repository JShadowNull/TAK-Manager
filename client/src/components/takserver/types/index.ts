import { z } from "zod";

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

export type OperationStatus = 'not_installed' | 'running' | 'stopped';

export interface TakServerStatusEvent {
  status: string;
  error?: string;
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

export interface TakServerState {
  isInstalled: boolean;
  isRunning: boolean;
  version?: string;
  status?: string;
  error?: string | null;
}

// HTTP Response Types
export interface InstallationProgress {
  success: boolean;
  status: 'in_progress' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface OperationProgress {
  success: boolean;
  operation: 'start' | 'stop' | 'restart' | null;
  progress: number;
  status: 'idle' | 'in_progress' | 'complete';
  error?: string;
}

export interface PopupsProps {
  // Installation props
  showInstallProgress: boolean;
  showInstallComplete: boolean;
  installProgress: number;
  installError?: string;
  onInstallProgressClose: () => void;
  onInstallComplete: () => void;
  terminalOutput: string[];

  // Uninstallation props
  showUninstallConfirm: boolean;
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallProgress: number;
  uninstallError?: string;
  onUninstallConfirmClose: () => void;
  onUninstall: () => void;
  onUninstallProgressClose: () => void;
  onUninstallComplete: () => void;
}

export interface UninstallOptions {
  taskId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export type UpdateState = (state: any) => void; 