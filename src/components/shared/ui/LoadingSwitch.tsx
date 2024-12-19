import React, { useEffect } from 'react';
import { Switch } from './shadcn/switch';
import type { OperationType } from '../hooks/useOperationStatus';
import { cn } from "@/lib/utils";

interface LoadingSwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof Switch>, 'disabled'> {
  operation: OperationType;
  isLoading: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  showLoadingState?: boolean;
}

export const LoadingSwitch: React.FC<LoadingSwitchProps> = ({
  operation,
  isLoading,
  message,
  progress,
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
      message,
      progress,
      showProgress,
      showLoadingState,
      checked: switchProps.checked
    });
  }, [operation, isLoading, message, progress, showProgress, showLoadingState, switchProps.checked]);

  // Default loading messages
  const defaultMessages: Record<OperationType, string> = {
    start: 'Starting...',
    stop: 'Stopping...',
    restart: 'Restarting...',
    install: 'Installing...',
    uninstall: 'Uninstalling...',
    update: 'Updating...',
    configure: 'Configuring...',
    validate: 'Validating...',
  };

  const loadingMessage = message || defaultMessages[operation] || 'Loading...';
  const progressText = showProgress && progress ? ` (${Math.round(progress)}%)` : '';
  const displayMessage = `${loadingMessage}${progressText}`;

  // Debug logging for rendered state
  console.debug('LoadingSwitch render state:', {
    displayMessage,
    isDisabled: isLoading,
    hasLoadingAnimation: isLoading && showLoadingState,
    showingLoadingMessage: isLoading && showLoadingState
  });

  return (
    <div className="flex items-center gap-2">
      <Switch
        {...switchProps}
        disabled={isLoading}
        className={cn(
          isLoading && showLoadingState && "animate-pulse",
          className
        )}
      />
      {isLoading && showLoadingState && (
        <span className="text-sm text-muted-foreground">{displayMessage}</span>
      )}
    </div>
  );
}; 