import React from 'react';
import { Button, type ButtonProps } from '../shadcn/button';
import { cn } from '../../../../lib/utils';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface LoadingButtonProps extends Omit<ButtonProps, 'loading' | 'loadingText' | 'onError'> {
  taskId: string;
  showSpinner?: boolean;
  loadingMessage?: string;
  successMessage?: string;
  failureMessage?: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  taskId,
  showSpinner = true,
  loadingMessage,
  successMessage,
  failureMessage = 'Operation failed',
  onComplete,
  onError,
  children,
  ...buttonProps
}) => {
  const getStateMessage = () => {
    return undefined;
  };

  return (
    <Button
      {...buttonProps}
      className={cn(
        buttonProps.className,
      )}
    >
      {getStateMessage() || children}
    </Button>
  );
};

export default LoadingButton; 