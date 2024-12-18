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
  // Get connected device IDs and status from deviceStatus
  const connectedDevices = new Set(
    deviceStatus.devices ? Object.keys(deviceStatus.devices) : []
  );

  const getDeviceStatusColor = () => {
    if (!deviceStatus) return 'text-yellow-500';
    if (deviceStatus.isConnected) {
      return isTransferRunning ? 'text-blue-500' : 'text-green-500';
    }
    return 'text-yellow-500';
  };

  const getDeviceStatusText = () => {
    if (!deviceStatus) return 'Checking device status...';
    if (!deviceStatus.text) {
      return deviceStatus.isConnected 
        ? `Connected devices: ${Array.from(connectedDevices).join(', ')}` 
        : 'Waiting for device...';
    }
    return deviceStatus.text;
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-lg foreground border-1 border-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base">Transfer Status</h2>
        <StatusButtons
          isTransferRunning={isTransferRunning}
          filesExist={filesExist}
          isDeviceConnected={connectedDevices.size > 0}
          onStartTransfer={onStartTransfer}
          onStopTransfer={onStopTransfer}
        />
      </div>

      <div className="space-y-4">
        {/* Device Status Section */}
        <div className="flex items-center gap-4 p-3 bg-background rounded-lg">
          <span className="text-sm font-medium">Device Status:</span>
          <span className={`text-sm ${getDeviceStatusColor()}`}>
            {getDeviceStatusText()}
          </span>
        </div>
        
        {/* Device Progress Section */}
        <div className="space-y-4">
          {Object.entries(deviceProgress || {}).map(([deviceId, progress]) => (
            <DeviceProgress
              key={deviceId}
              deviceId={deviceId}
              progress={progress}
              onRemoveFailed={onRemoveFailed}
              isTransferRunning={isTransferRunning}
              isDeviceConnected={connectedDevices.has(deviceId)}
            />
          ))}
          
          {/* No Progress Message */}
          {(!deviceProgress || Object.keys(deviceProgress).length === 0) && (
            <div className="text-sm text-textSecondary text-center p-4">
              {isTransferRunning 
                ? 'Initializing transfer...' 
                : connectedDevices.size > 0 
                  ? 'Ready to transfer files' 
                  : 'Connect a device to begin transfer'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 