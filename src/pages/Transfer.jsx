import React, { useState, useRef } from 'react';
import AdbInstallation from '../components/transfer/AdbInstallation';
import { FileUpload } from '../components/transfer/FileUpload';
import { TransferStatus } from '../components/transfer/TransferStatus';
import { TransferLog } from '../components/transfer/TransferLog';
import { TransferInfo } from '../components/transfer/TransferInfo';
import useFetch from '../components/shared/hooks/useFetch';
import useSocket from '../components/shared/hooks/useSocket';

function Transfer() {
  // State management
  const [files, setFiles] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({ text: 'Waiting for device...', isConnected: false });
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [deviceProgress, setDeviceProgress] = useState({});
  const [logs, setLogs] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Set());
  const [adbInstallation, setAdbInstallation] = useState({
    isInstalling: false,
    currentStep: 0,
    isComplete: false,
    isSuccess: true,
    terminalOutput: []
  });

  const fileInputRef = useRef(null);
  const { get, post } = useFetch();

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

  // Socket event handlers
  const socketEventHandlers = {
    onConnect: (socket) => {
      addLog('Connected to server');
      // Get current state when connecting/reconnecting
      if (socket) {
        socket.emit('get_connected_devices');
        socket.emit('get_transfer_status');
        
        // Get current files if transfer is running
        get('/transfer/get_files')
          .then(data => {
            if (data.status === 'success') {
              setFiles(data.files);
            }
          })
          .catch(error => {
            console.error('Error getting files:', error);
          });
      }
    },

    // New consolidated device updates
    device_update: (data) => {
      const { type, devices, timestamp } = data;

      switch (type) {
        case 'list':
          if (devices?.length > 0) {
            const deviceList = devices.map(device => device.id).join(', ');
            const connectedDeviceIds = new Set(devices.map(device => device.id));
            
            setDeviceStatus({
              text: `Connected devices: ${deviceList}`,
              isConnected: true,
              devices: devices.reduce((acc, device) => {
                acc[device.id] = device;
                return acc;
              }, {})
            });

            // Clean up progress for disconnected devices
            setDeviceProgress(prev => {
              const newProgress = { ...prev };
              Object.keys(newProgress).forEach(deviceId => {
                if (!connectedDeviceIds.has(deviceId) && newProgress[deviceId].status !== 'failed') {
                  delete newProgress[deviceId];
                }
              });
              return newProgress;
            });
          } else {
            setDeviceStatus({
              text: 'Waiting for device...',
              isConnected: false,
              devices: {}
            });
          }
          break;

        case 'connection':
        case 'state_change':
          const device = devices[0]; // Single device update
          if (device) {
            addLog(device.message);
            setDeviceStatus(prev => ({
              ...prev,
              devices: {
                ...prev.devices,
                [device.id]: device
              }
            }));
          }
          break;
      }
    },

    // New consolidated transfer updates
    transfer_update: (data) => {
      const { type, state, device_id, isRunning, error, timestamp, ...rest } = data;

      // Update global transfer state
      if (isRunning !== undefined) {
        setIsTransferRunning(isRunning);
      }

      switch (type) {
        case 'status':
          switch (state) {
            case 'starting':
              addLog('Transfer started');
              const connectedDevices = Object.keys(deviceStatus.devices || {});
              const initialProgress = {};
              connectedDevices.forEach(deviceId => {
                initialProgress[deviceId] = {
                  progress: 0,
                  status: 'preparing',
                  currentFile: '',
                  fileProgress: 0,
                  fileNumber: 0,
                  totalFiles: rest.total_files || 0
                };
              });
              setDeviceProgress(initialProgress);
              break;

            case 'stopped':
              addLog('Transfer stopped');
              break;

            case 'completed':
              if (device_id) {
                setDeviceProgress(prev => ({
                  ...prev,
                  [device_id]: {
                    ...prev[device_id],
                    status: 'completed',
                    currentFile: '',
                    progress: 100,
                    fileProgress: 100,
                    fileNumber: prev[device_id]?.totalFiles || 0,
                    totalFiles: prev[device_id]?.totalFiles || 0
                  }
                }));
                addLog(`Transfer completed for device ${device_id}`);
              }
              break;
          }
          break;

        case 'progress':
          if (device_id) {
            setDeviceProgress(prev => {
              if (['failed', 'completed'].includes(prev[device_id]?.status)) {
                return prev;
              }
              
              return {
                ...prev,
                [device_id]: {
                  ...prev[device_id],
                  currentFile: rest.current_file,
                  fileProgress: rest.file_progress,
                  fileNumber: rest.files_completed,
                  totalFiles: rest.total_files,
                  status: state || 'transferring',
                  progress: rest.overall_progress
                }
              };
            });
          }
          break;

        case 'error':
          addLog(error);
          if (device_id) {
            setDeviceProgress(prev => ({
              ...prev,
              [device_id]: {
                ...prev[device_id],
                status: 'failed',
                currentFile: rest.last_file || prev[device_id]?.currentFile,
                progress: rest.last_progress ?? prev[device_id]?.progress ?? 0
              }
            }));
          }
          break;
      }
    },

    // New consolidated file updates
    file_update: (data) => {
      const { type, files, timestamp } = data;

      switch (type) {
        case 'list':
          setFiles(files);
          break;

        case 'change':
          const { filename, action } = files;
          if (action === 'uploaded') {
            setFiles(prev => prev.includes(filename) ? prev : [...prev, filename]);
            addLog(`Uploaded ${filename} successfully`);
          } else if (action === 'deleted') {
            setFiles(prev => prev.filter(f => f !== filename));
            addLog(`Deleted ${filename} successfully`);
          }
          break;
      }
    },

    // New consolidated ADB updates
    adb_update: (data) => {
      const { type, state, message, error, timestamp } = data;

      switch (type) {
        case 'status':
          switch (state) {
            case 'checking':
              setAdbInstallation(prev => ({
                ...prev,
                currentStep: 1,
                terminalOutput: [...prev.terminalOutput, message]
              }));
              break;

            case 'installing':
              setAdbInstallation(prev => ({
                ...prev,
                isInstalling: true,
                currentStep: 2,
                terminalOutput: [...prev.terminalOutput, message]
              }));
              break;

            case 'completed':
              setAdbInstallation(prev => ({
                ...prev,
                isInstalling: false,
                isComplete: true,
                isSuccess: true,
                currentStep: 3,
                terminalOutput: [...prev.terminalOutput, message]
              }));
              break;
          }
          break;

        case 'error':
          setAdbInstallation(prev => ({
            ...prev,
            isInstalling: false,
            isComplete: true,
            isSuccess: false,
            currentStep: 4,
            terminalOutput: [...prev.terminalOutput, error]
          }));
          break;
      }
    }
  };

  const { socket, isConnected } = useSocket('/transfer', {
    eventHandlers: socketEventHandlers,
    initialState: {},
    options: { transports: ['websocket'] }
  });

  const handleFileUpload = (uploadedFiles) => {
    Array.from(uploadedFiles).forEach(file => {
      if (uploadingFiles.has(file.name)) {
        addLog(`File ${file.name} is already being uploaded`);
        return;
      }

      setUploadingFiles(prev => new Set([...prev, file.name]));
      
      const formData = new FormData();
      formData.append('file', file);

      post('/transfer/upload_file', formData)
        .then(data => {
          if (data.status === 'success') {
            setFiles(prev => prev.includes(file.name) ? prev : [...prev, file.name]);
            addLog(`Uploaded ${file.name} successfully`);
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        })
        .catch(error => {
          addLog(`Error uploading ${file.name}: ${error.message}`);
          console.error('Upload error:', error);
        })
        .finally(() => {
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(file.name);
            return next;
          });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        });
    });
  };

  const removeFailedTransfer = (deviceId) => {
    setDeviceProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[deviceId];
      return newProgress;
    });
  };

  const startTransfer = () => {
    setIsTransferRunning(true);
    socket.emit('start_transfer');
    addLog('Starting file transfer...');
  };

  const stopTransfer = () => {
    setIsTransferRunning(false);
    socket.emit('stop_transfer');
    addLog('Stopping transfer...');
  };

  const handleFileDelete = async (filename) => {
    try {
      const data = await post('/transfer/delete_file', { filename });
      if (data.status === 'success') {
        setFiles(prev => prev.filter(f => f !== filename));
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(filename);
          return next;
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        addLog(`Deleted ${filename} successfully`);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      addLog(`Error deleting ${filename}: ${error.message}`);
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      <TransferInfo />
      
      <FileUpload 
        files={files}
        uploadingFiles={uploadingFiles}
        onFileUpload={handleFileUpload}
        onDeleteFile={handleFileDelete}
        disabled={isTransferRunning}
      />

      <TransferStatus
        deviceStatus={deviceStatus}
        deviceProgress={deviceProgress}
        isTransferRunning={isTransferRunning}
        filesExist={files.length > 0}
        onRemoveFailed={removeFailedTransfer}
        onStartTransfer={startTransfer}
        onStopTransfer={stopTransfer}
      />

      <TransferLog logs={logs} />

      <AdbInstallation 
        adbInstallation={adbInstallation}
        setAdbInstallation={setAdbInstallation}
        socketRef={{ current: socket }}
      />
    </div>
  );
}

export default Transfer; 