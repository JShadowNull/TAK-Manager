import React from 'react';
import { Switch } from '../shadcn/switch';
import { cn } from '../../../../lib/utils';
import { OperationType } from '../../types/operations';
import { useTaskStatus } from '../../hooks/useTaskStatus';

interface LoadingSwitchProps {
  taskId: string;
  checked: boolean;
  onCheckedChange: () => void;
  operation: OperationType;
  className?: string;
  runningMessage?: string;
  stoppedMessage?: string;
  loadingMessage?: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const LoadingSwitch: React.FC<LoadingSwitchProps> = ({
  taskId,
  checked,
  onCheckedChange,
  operation,
  className,
  runningMessage = 'Running',
  stoppedMessage = 'Stopped',
  loadingMessage,
  onComplete,
  onError
}) => {
  const { status, message } = useTaskStatus(taskId);

  const isLoading = status === 'loading';
  const isError = status === 'error';

  const getStatusColor = () => {
    if (isError) return "bg-destructive hover:bg-destructive";
    if (checked) return "bg-green-500 hover:bg-green-600";
    return "bg-red-500 hover:bg-red-600";
  };

  const getStateMessage = () => {
    if (message) return message;
    if (isLoading) return loadingMessage || `${operation}ing...`;
    if (isError) return 'Operation failed';
    return checked ? runningMessage : stoppedMessage;
  };

  const getTitle = () => {
    if (isLoading) return loadingMessage || `${operation}ing...`;
    if (isError) return 'Operation failed';
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
          isLoading && "opacity-50",
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