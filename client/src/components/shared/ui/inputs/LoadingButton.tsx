import React from 'react';
import { Button, type ButtonProps } from '../shadcn/button';
import type { OperationType, OperationStatus } from '../../hooks/useLoader';
import { cn } from '../../../../lib/utils';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface LoadingButtonProps extends Omit<ButtonProps, 'loading' | 'loadingText'> {
  operation: OperationType;
  isLoading: boolean;
  status?: OperationStatus['status'] | null;
  message?: string;
  progress?: number;
  error?: string;
  showProgress?: boolean;
  progressType?: 'spinner' | 'bar' | 'percentage';
  loadingMessage?: string;
  successMessage?: string;
  failedMessage?: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  operation,
  isLoading,
  status,
  message,
  progress,
  error,
  showProgress = false,
  progressType = 'spinner',
  loadingMessage,
  successMessage,
  failedMessage = 'Operation failed',
  children,
  ...buttonProps
}) => {
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

  const getStateMessage = () => {
    if (isLoading) {
      const progressText = showProgress && typeof progress === 'number' ? ` (${Math.round(progress)}%)` : '';
      const currentLoadingMessage = message || loadingMessage || defaultMessages[operation] || `${operation}ing...`;
      return `${currentLoadingMessage}${progressText}`;
    }
    if (error) return error;
    if (status === 'failed') return failedMessage;
    if (status === 'complete') return successMessage;
    return message;
  };

  // Progress indicator based on type
  const renderProgress = () => {
    if (!showProgress || !progress) return null;

    switch (progressType) {
      case 'spinner':
        return <LoadingSpinner />;
      case 'percentage':
        return `(${Math.round(progress)}%)`;
      case 'bar':
        return (
          <div className="w-full bg-primary rounded-full h-1.5 mb-1">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const getButtonClassName = () => {
    if (error || status === 'failed') return cn(buttonProps.className, 'bg-destructive hover:bg-destructive/90');
    return buttonProps.className;
  };

  return (
    <div className="flex flex-col w-fit">
      <Button
        {...buttonProps}
        className={getButtonClassName()}
        loading={isLoading}
        loadingText={getStateMessage()}
        disabled={isLoading || buttonProps.disabled}
      >
        {children}
      </Button>
      {progressType === 'bar' && renderProgress()}
    </div>
  );
};

export default LoadingButton; 