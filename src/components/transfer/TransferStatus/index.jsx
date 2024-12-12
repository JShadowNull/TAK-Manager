import { DeviceProgress } from './DeviceProgress';
import { StatusButtons } from './StatusButtons';

export const TransferStatus = ({
  deviceStatus,
  deviceProgress,
  isTransferRunning,
  filesExist,
  onRemoveFailed,
  onStartTransfer,
  onStopTransfer
}) => {
  return (
    <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
      <h2 className="text-base mb-4">Transfer Status</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm">Device Status:</span>
          <span className={`text-sm ${deviceStatus.isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
            {deviceStatus.text}
          </span>
        </div>
        
        {/* Device Progress Container */}
        <div className="space-y-4">
          {Object.entries(deviceProgress).map(([deviceId, progress]) => (
            <DeviceProgress
              key={deviceId}
              deviceId={deviceId}
              progress={progress}
              onRemoveFailed={onRemoveFailed}
            />
          ))}
        </div>

        <StatusButtons
          isTransferRunning={isTransferRunning}
          filesExist={filesExist}
          onStartTransfer={onStartTransfer}
          onStopTransfer={onStopTransfer}
        />
      </div>
    </div>
  );
}; 