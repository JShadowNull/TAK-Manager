import React, { useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { cn } from '../../../lib/utils';
import { useLoader } from '../hooks/useLoader';

const ContainerStateIcon = ({ 
  containerName, 
  isRunning,
  disabled,
  onOperation,
  onOperationComplete
}) => {
  const { 
    isLoading,
    error: hasError,
    message,
    operation,
    executeWithLoading
  } = useLoader({
    namespace: '/docker-manager',
    operationType: isRunning ? 'stop' : 'start',
    targetId: containerName,
    onComplete: () => {
      console.debug('[ContainerStateIcon] Operation complete:', {
        containerName,
        operation: isRunning ? 'stop' : 'start'
      });
      onOperationComplete?.();
    },
    onError: (error) => {
      console.error('[ContainerStateIcon] Operation failed:', {
        containerName,
        error,
        operation: isRunning ? 'stop' : 'start'
      });
    },
    operation: onOperation
  });

  const handleClick = useCallback(async () => {
    if (isLoading || disabled) {
      console.debug('[ContainerStateIcon] Click ignored:', {
        isLoading,
        disabled,
        containerName
      });
      return;
    }
    
    const action = isRunning ? 'stop' : 'start';
    console.debug('[ContainerStateIcon] Handling click:', {
      containerName,
      action,
      isRunning,
      isLoading
    });
    
    try {
      await executeWithLoading({
        loadingMessage: `${action.charAt(0).toUpperCase() + action.slice(1)}ing container...`,
        errorMessage: `Failed to ${action} container`
      });
    } catch (error) {
      console.error('[ContainerStateIcon] Operation failed:', {
        error,
        containerName,
        action
      });
    }
  }, [isLoading, isRunning, executeWithLoading, containerName, disabled]);

  const getStatusColor = () => {
    if (isLoading) return "text-primary animate-pulse";
    if (hasError) return "text-red-500";
    if (disabled) return "text-gray-400";
    return isRunning ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600";
  };

  const getTitle = () => {
    if (disabled) return 'Docker must be running to manage containers';
    if (isLoading) return message;
    if (hasError) return message || 'Operation failed';
    return isRunning ? 'Stop container' : 'Start container';
  };

  const renderIcon = () => {
    console.debug('[ContainerStateIcon] Rendering icon:', {
      containerName,
      isLoading,
      isRunning,
      operation,
      hasError
    });

    if (isLoading) {
      return (
        <>
          <FontAwesomeIcon 
            icon={faSpinner} 
            className="animate-spin"
            data-testid="loading-spinner"
          />
          <span className="sr-only">{message}</span>
        </>
      );
    }

    return (
      <>
        <FontAwesomeIcon 
          icon={isRunning ? faStop : faPlay} 
          data-testid="action-icon"
        />
        <span className="sr-only">
          {isRunning ? 'Stop' : 'Start'} {containerName}
        </span>
      </>
    );
  };

  return (
    <button
      className={cn(
        "focus:outline-none text-lg transition-colors duration-200",
        getStatusColor(),
        (isLoading || disabled) && "opacity-50 cursor-not-allowed"
      )}
      disabled={isLoading || disabled}
      onClick={handleClick}
      title={getTitle()}
      data-state={isLoading ? 'loading' : hasError ? 'error' : 'idle'}
      data-running={isRunning}
      data-testid="container-state-icon"
    >
      <div className="relative">
        {renderIcon()}
      </div>
    </button>
  );
};

export default React.memo(ContainerStateIcon); 