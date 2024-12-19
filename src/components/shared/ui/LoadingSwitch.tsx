import React, { useEffect } from 'react';
import { Switch } from './shadcn/switch';
import { cn } from "@/lib/utils";

// Match backend operation types
type OperationType = 
  | 'start'
  | 'stop'
  | 'restart'
  | 'install'
  | 'uninstall'
  | 'update'
  | 'configure'
  | 'validate';

type StatusType = 'in_progress' | 'complete' | 'failed';

interface LoadingSwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof Switch>, 'disabled'> {
  operation: OperationType;
  isLoading: boolean;
  status?: StatusType;
  message?: string;
  progress?: number;
  error?: string;
  showProgress?: boolean;
  showLoadingState?: boolean;
}

export const LoadingSwitch: React.FC<LoadingSwitchProps> = ({
  operation,
  isLoading,
  status = 'complete',
  message,
  progress,
  error,
  showProgress = false,
  showLoadingState = true,
  className,
  ...switchProps
}) => {
  // Debug logging for prop changes
  useEffect(() => {
    console.debug('LoadingSwitch props updated:', {
      operation,
      isLoading,
      status,
      message,
      progress,
      error,
      showProgress,
      showLoadingState,
      checked: switchProps.checked
    });
  }, [operation, isLoading, status, message, progress, error, showProgress, showLoadingState, switchProps.checked]);

  const loadingMessage = message || 'Loading...';
  const progressText = showProgress && typeof progress === 'number' ? ` (${Math.round(progress)}%)` : '';
  const displayMessage = error || `${loadingMessage}${progressText}`;
  const isInProgress = status === 'in_progress';
  const shouldShowLoading = (isLoading || isInProgress) && showLoadingState;
  const hasError = !!error || status === 'failed';

  // Debug logging for rendered state
  console.debug('LoadingSwitch render state:', {
    displayMessage,
    isDisabled: shouldShowLoading,
    hasLoadingAnimation: shouldShowLoading,
    showingLoadingMessage: shouldShowLoading,
    hasError,
    status,
    isLoading
  });

  return (
    <div className="flex items-center gap-2">
      <Switch
        {...switchProps}
        disabled={shouldShowLoading}
        className={cn(
          shouldShowLoading && "animate-pulse opacity-50",
          hasError && "bg-destructive hover:bg-destructive",
          className
        )}
      />
      {shouldShowLoading && (
        <span className="text-sm text-muted-foreground">
          {displayMessage}
        </span>
      )}
    </div>
  );
}; 