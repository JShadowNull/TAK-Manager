import React, { ButtonHTMLAttributes } from 'react';
import Button from './Button';
import type { OperationType } from '../hooks/useLoader';
import { useLoader } from '../hooks/useLoader';
import { cn } from '../../../lib/utils';
import type { ButtonProps } from './Button';

interface LoadingButtonProps extends Omit<ButtonProps, 'loading' | 'loadingText'> {
  operation: OperationType;
  isLoading: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  progressType?: 'spinner' | 'bar' | 'percentage';
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  operation,
  isLoading,
  message,
  progress,
  showProgress = false,
  progressType = 'spinner',
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

  const loadingMessage = message || defaultMessages[operation] || 'Loading...';

  // Progress indicator based on type
  const renderProgress = () => {
    if (!showProgress || !progress) return null;

    switch (progressType) {
      case 'percentage':
        return `(${Math.round(progress)}%)`;
      case 'bar':
        return (
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
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

  return (
    <div className="flex flex-col w-fit">
      <Button
        {...buttonProps}
        loading={isLoading}
        loadingText={showProgress && progress ? `${loadingMessage} ${renderProgress()}` : loadingMessage}
      >
        {children}
      </Button>
      {progressType === 'bar' && renderProgress()}
    </div>
  );
};

export default LoadingButton; 