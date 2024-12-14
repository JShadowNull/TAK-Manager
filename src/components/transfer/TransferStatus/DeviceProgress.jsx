import { CloseIcon } from '../../shared/icons/CloseIcon';

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
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

  // Get progress text based on status
  const getProgressText = () => {
    if (progress.status === 'failed') {
      return `${progress.progress}% (Failed)`;
    }
    return `${progress.progress}% (File ${progress.fileNumber}/${progress.totalFiles}: ${progress.fileProgress}%)`;
  };

  return (
    <div className="device-progress bg-primaryBg border-1 border-buttonBorder rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">Device: {deviceId}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {getProgressText()}
          </span>
          {progress.status === 'failed' && (
            <button
              onClick={() => onRemoveFailed(deviceId)}
              title="Remove failed transfer"
            >
              <CloseIcon 
                color="#ef4444"
                size="small"
                onClick={() => onRemoveFailed(deviceId)}
              />
            </button>
          )}
        </div>
      </div>
      <div className="relative w-full h-2 bg-buttonColor rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-in-out ${
            getProgressBarColor(progress.status)
          } ${progress.status === 'preparing' ? 'animate-pulse' : ''}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <span className="text-sm text-textSecondary">
          {progress.currentFile}
        </span>
        <span className={`text-sm ${progress.status === 'failed' ? 'text-red-500' : 'text-textSecondary'}`}>
          Status: {progress.status}
        </span>
      </div>
    </div>
  );
}; 