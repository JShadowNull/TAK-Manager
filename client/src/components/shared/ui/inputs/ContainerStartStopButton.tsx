import React, { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../shadcn/button';
import { cn } from '../../../../lib/utils';

export interface ContainerStateIconProps {
  name: string;
  isRunning: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onOperation: (name: string, action: string) => void;
}

const ContainerStateIcon: React.FC<ContainerStateIconProps> = ({
  name,
  isRunning,
  isLoading = false,
  disabled = false,
  onOperation,
}) => {
  const handleClick = useCallback(() => {
    if (isLoading || disabled) {
      return;
    }
    
    const action = isRunning ? 'stop' : 'start';
    onOperation(name, action);
  }, [isLoading, isRunning, onOperation, name, disabled]);

  const getStatusColor = () => {
    if (isLoading) return "";
    if (disabled) return "text-gray-400";
    return isRunning ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600";
  };

  return (
    <Button
      variant="outline"
      size="default"
      onClick={handleClick}
      disabled={isLoading || disabled}
      loading={isLoading}
      loadingText={isRunning ? "Stopping..." : "Starting..."}
      className={cn("w-full", getStatusColor())}
      leadingIcon={
        <FontAwesomeIcon 
          icon={isRunning ? faStop : faPlay}
          className="h-4 w-4"
        />
      }
    >
      {isRunning ? 'Stop' : 'Start'}
    </Button>
  );
};

export default React.memo(ContainerStateIcon); 