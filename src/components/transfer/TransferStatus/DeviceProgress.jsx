import { CloseIcon } from '../Icons/CloseIcon';

export const DeviceProgress = ({ deviceId, progress, onRemoveFailed }) => {
  return (
    <div className="device-progress bg-buttonColor border-1 border-buttonBorder rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">Device: {deviceId}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {progress.progress}%
            {progress.fileProgress !== undefined && 
              ` (File ${progress.fileNumber}/${progress.totalFiles}: ${progress.fileProgress}%)`}
          </span>
          {progress.status === 'failed' && (
            <button
              onClick={() => onRemoveFailed(deviceId)}
              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-500/10"
              title="Remove failed transfer"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      <div className="relative w-full h-2 bg-primaryBg rounded-full overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-in-out ${
            progress.status === 'completed' ? 'bg-green-500' :
            progress.status === 'failed' ? 'bg-red-500' :
            progress.status === 'transferring' ? 'bg-blue-500' :
            'bg-yellow-500'
          } ${progress.status === 'connecting' ? 'animate-pulse' : ''}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <span className="text-sm text-textSecondary">
          {progress.currentFile}
        </span>
        <span className="text-sm text-textSecondary">
          Status: {progress.status}
        </span>
      </div>
    </div>
  );
}; 