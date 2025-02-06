import { CloseIcon } from '../../shared/ui/icons/CloseIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shared/ui/shadcn/tooltip/tooltip';

export const DeviceProgress = ({ deviceId, progress, onRemoveFailed, isTransferRunning, isDeviceConnected }) => {
  // Different visibility rules:
  // 1. Always show if transfer is running
  // 2. For completed status: only show if device is still connected
  // 3. For failed status: show until manually closed (regardless of connection)
  if (!isTransferRunning && 
      !(progress.status === 'completed' && isDeviceConnected) && 
      progress.status !== 'failed') {
    return null;
  }

  // Get progress bar color based on status
  const getProgressBarColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'transferring':
        return 'bg-selectedColor';
      case 'preparing':
        return 'bg-yellow-500';
      default:
        return 'bg-primary';
    }
  };

  // Get progress text based on status and progress info
  const getProgressText = () => {
    if (!progress) return '';
    
    switch (progress.status) {
      case 'failed':
        return `${progress.progress || 0}% (Failed)`;
      case 'completed':
        return '100% (Complete)';
      case 'preparing':
        return 'Preparing...';
      case 'transferring':
        return `${progress.progress}% (File ${progress.fileNumber}/${progress.totalFiles}: ${progress.fileProgress}%)`;
      default:
        return `${progress.progress || 0}%`;
    }
  };

  // Get status text with proper formatting
  const getStatusText = () => {
    if (!progress) return '';
    
    switch (progress.status) {
      case 'failed':
        return 'Transfer Failed';
      case 'completed':
        return 'Transfer Complete';
      case 'preparing':
        return 'Preparing Transfer';
      case 'transferring':
        return 'Transferring Files';
      default:
        return progress.status || 'Unknown';
    }
  };

  return (
    <div className="device-progress bg-background border-1 border-border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium foreground">Device: {deviceId}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium foreground">
            {getProgressText()}
          </span>
          {progress.status === 'failed' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onRemoveFailed(deviceId)}
                    className="focus:outline-hidden hover:opacity-80 transition-opacity"
                    aria-label="Remove failed transfer"
                  >
                    <CloseIcon 
                      color="#ef4444"
                      size="small"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove failed transfer from list</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="relative w-full h-2 bg-primary rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-in-out ${
            getProgressBarColor(progress.status)
          } ${progress.status === 'preparing' ? 'animate-pulse' : ''}`}
          style={{ width: `${progress.progress || 0}%` }}
          role="progressbar"
          aria-valuenow={progress.progress || 0}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      <div className="flex flex-col gap-1 mt-2">
        {progress.currentFile && (
          <span className="text-sm text-textSecondary truncate" title={progress.currentFile}>
            Current File: {progress.currentFile}
          </span>
        )}
        <span className={`text-sm ${
          progress.status === 'failed' ? 'text-red-500' : 
          progress.status === 'completed' ? 'text-green-500' : 
          'text-textSecondary'
        }`}>
          Status: {getStatusText()}
        </span>
      </div>
    </div>
  );
}; 