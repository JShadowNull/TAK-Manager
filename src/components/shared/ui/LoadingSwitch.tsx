import React, { useEffect } from 'react';
import { Switch } from './shadcn/switch';
import { cn } from '../../../lib/utils';
import { OperationType, OperationStatus } from '../hooks/useLoader';

interface LoadingSwitchProps {
  checked: boolean;
  onCheckedChange: () => void;
  operation: OperationType;
  isLoading: boolean;
  status?: OperationStatus['status'] | null;
  message?: string;
  progress?: number;
  error?: string;
  showProgress?: boolean;
  showLoadingState?: boolean;
  className?: string;
  runningMessage?: string;
  stoppedMessage?: string;
  failedMessage?: string;
  loadingMessage?: string;
}

export const LoadingSwitch: React.FC<LoadingSwitchProps> = ({
  checked,
  onCheckedChange,
  operation,
  isLoading,
  status,
  message,
  progress,
  error,
  showProgress = false,
  showLoadingState = true,
  className,
  runningMessage = 'Running',
  stoppedMessage = 'Stopped',
  failedMessage = 'Operation failed',
  loadingMessage
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
      checked
    });
  }, [operation, isLoading, status, message, progress, error, showProgress, showLoadingState, checked]);

  const getStatusColor = () => {
    if (error || status === 'failed') return "bg-destructive hover:bg-destructive";
    if (checked) return "bg-green-500 hover:bg-green-600";
    return "bg-red-500 hover:bg-red-600";
  };

  const getStateMessage = () => {
    if (isLoading) {
      const progressText = showProgress && typeof progress === 'number' ? ` (${Math.round(progress)}%)` : '';
      const currentLoadingMessage = message || loadingMessage || `${operation}ing...`;
      return `${currentLoadingMessage}${progressText}`;
    }
    if (error) return error;
    if (status === 'failed') return failedMessage;
    return checked ? runningMessage : stoppedMessage;
  };

  const getTitle = () => {
    if (isLoading) return message || loadingMessage || `${operation}ing...`;
    if (error) return error;
    if (status === 'failed') return failedMessage;
    return checked ? `Stop ${runningMessage}` : `Start ${stoppedMessage}`;
  };

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={isLoading}
        className={cn(
          "transition-colors duration-200",
          isLoading ? "opacity-50" : "",
          getStatusColor(),
          className
        )}
        title={getTitle()}
        data-state={isLoading ? 'loading' : status || (checked ? 'checked' : 'unchecked')}
      />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {getStateMessage()}
      </span>
    </div>
  );
}; 