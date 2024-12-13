import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import AdbInstallation from '../components/transfer/AdbInstallation';
import { FileUpload } from '../components/transfer/FileUpload';
import { TransferStatus } from '../components/transfer/TransferStatus';
import { TransferLog } from '../components/transfer/TransferLog';
import { TransferInfo } from '../components/transfer/TransferInfo';
import { DeviceProgress } from '../components/transfer/TransferStatus/DeviceProgress';

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

  // Refs
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('/transfer', { transports: ['websocket'] });
    
    // Socket event handlers
    socketRef.current.on('connect', () => {
      addLog('Connected to server');
      // Get current state when connecting/reconnecting
      socketRef.current.emit('get_connected_devices');
      socketRef.current.emit('get_transfer_status');
      
      // Get current files if transfer is running
      fetch('/transfer/get_files')
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            setFiles(data.files);
          }
        })
        .catch(error => {
          console.error('Error getting files:', error);
        });
    });

    // Update device list and handle progress bars
    socketRef.current.on('connected_devices', (data) => {
      if (data.devices?.length > 0) {
        const deviceList = data.devices.map(device => device.id).join(', ');
        const connectedDeviceIds = new Set(data.devices.map(device => device.id));
        
        setDeviceStatus({
          text: `Connected devices: ${deviceList}`,
          isConnected: true,
          devices: data.devices.reduce((acc, device) => {
            acc[device.id] = device;
            return acc;
          }, {})
        });

        // Clean up progress for disconnected devices
        setDeviceProgress(prev => {
          const newProgress = { ...prev };
          // Remove progress entries for devices that are no longer connected
          // unless they have failed status
          Object.keys(newProgress).forEach(deviceId => {
            if (!connectedDeviceIds.has(deviceId) && newProgress[deviceId].status !== 'failed') {
              delete newProgress[deviceId];
            }
          });
          
          // Initialize progress for new devices if transfer is running
          data.devices.forEach(device => {
            if (data.isTransferRunning && !newProgress[device.id]) {
              newProgress[device.id] = {
                progress: 0,
                status: device.status || 'preparing',
                currentFile: '',
                fileProgress: 0,
                fileNumber: 0,
                totalFiles: 0
              };
            }
          });

          return newProgress;
        });

        // Update transfer running state based on server response
        if (data.isTransferRunning) {
          setIsTransferRunning(true);
        }
      } else {
        // No devices connected
        setDeviceStatus({
          text: 'Waiting for device...',
          isConnected: false,
          devices: {}
        });

        // Clean up all progress except failed ones
        setDeviceProgress(prev => {
          const newProgress = { ...prev };
          Object.keys(newProgress).forEach(deviceId => {
            if (newProgress[deviceId].status !== 'failed') {
              delete newProgress[deviceId];
            }
          });
          return newProgress;
        });
      }
    });

    // Handle transfer status updates
    socketRef.current.on('transfer_status', (data) => {
      // Update isTransferRunning based on server status
      if (data.isRunning !== undefined) {
        setIsTransferRunning(data.isRunning);
      }

      if (data.status === 'starting') {
        addLog('Transfer started');
        // Initialize progress containers for all connected devices
        const connectedDevices = Object.keys(deviceStatus.devices || {});
        const initialProgress = {};
        connectedDevices.forEach(deviceId => {
          initialProgress[deviceId] = {
            progress: 0,
            status: 'preparing',
            currentFile: '',
            fileProgress: 0,
            fileNumber: 0,
            totalFiles: data.totalFiles || 0
          };
        });
        setDeviceProgress(initialProgress);
      } else if (data.status === 'stopped') {
        addLog('Transfer stopped');
      } else if (data.device_id) {
        setDeviceProgress(prev => {
          const newProgress = { ...prev };
          const currentDevice = prev[data.device_id] || {};
          
          // Don't update if device is already in this status
          if (currentDevice?.status === data.status) {
            return prev;
          }
          
          switch (data.status) {
            case 'failed':
              newProgress[data.device_id] = {
                ...currentDevice,
                status: 'failed',
                currentFile: data.current_file || currentDevice.currentFile,
                progress: data.progress ?? currentDevice.progress ?? 0,
                fileProgress: currentDevice.fileProgress || 0,
                fileNumber: currentDevice.fileNumber || 0,
                totalFiles: currentDevice.totalFiles || 0
              };
              break;

            case 'completed':
              newProgress[data.device_id] = {
                ...currentDevice,
                status: 'completed',
                currentFile: '',
                progress: 100,
                fileProgress: 100,
                fileNumber: currentDevice.totalFiles,
                totalFiles: currentDevice.totalFiles
              };
              addLog(`Transfer completed for device ${data.device_id}`);
              break;

            default:
              newProgress[data.device_id] = {
                ...currentDevice,
                status: data.status
              };
          }
          
          return newProgress;
        });
      }
    });

    // Handle individual device progress updates
    socketRef.current.on('transfer_progress', (data) => {
      const { device_id, current_file, file_progress, overall_progress, status, current_file_number, total_files } = data;
      
      setDeviceProgress(prev => {
        // Don't update if the device is in a terminal state (failed/completed)
        if (['failed', 'completed'].includes(prev[device_id]?.status)) {
          return prev;
        }
        
        // Create new progress object with all current values
        const newProgress = {
          ...prev,
          [device_id]: {
            ...prev[device_id],
            currentFile: current_file,
            fileProgress: file_progress,
            fileNumber: current_file_number,
            totalFiles: total_files,
            status: status,
            progress: overall_progress
          }
        };
        
        return newProgress;
      });
    });

    // Add terminal output handler
    socketRef.current.on('terminal_output', (data) => {
      // Add to transfer log
      addLog(data.data);
      
      // Also update ADB installation logs if needed
      setAdbInstallation(prev => ({
        ...prev,
        terminalOutput: [...prev.terminalOutput, data.data]
      }));
    });

    // Add installation status handlers
    socketRef.current.on('installation_started', () => {
      setAdbInstallation(prev => ({
        ...prev,
        isInstalling: true,
        currentStep: 2,
        terminalOutput: [...prev.terminalOutput, "Installation started..."]
      }));
    });

    socketRef.current.on('installation_complete', () => {
      setAdbInstallation(prev => ({
        ...prev,
        isInstalling: false,
        isComplete: true,
        isSuccess: true,
        currentStep: 3,
        terminalOutput: [...prev.terminalOutput, "Installation completed successfully"]
      }));
    });

    socketRef.current.on('installation_failed', (data) => {
      setAdbInstallation(prev => ({
        ...prev,
        isInstalling: false,
        isComplete: true,
        isSuccess: false,
        currentStep: 4,
        terminalOutput: [...prev.terminalOutput, `Installation failed: ${data.error}`]
      }));
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        // Create a promise that resolves when we get the transfer status
        const getTransferStatus = new Promise((resolve) => {
          socketRef.current.once('transfer_status', (data) => {
            resolve(data.isRunning);
          });
          socketRef.current.emit('get_transfer_status');
        });

        // Wait for status and then handle cleanup
        getTransferStatus.then(isRunning => {
          if (!isRunning) {
            fetch('/transfer/cleanup', {
              method: 'POST',
            }).catch(error => {
              console.error('Error cleaning up temp directory:', error);
            });
          }
          socketRef.current.disconnect();
        });
      }
    };
  }, []);

  // Add separate useEffect for handling new devices during active transfer
  useEffect(() => {
    if (isTransferRunning && socketRef.current) {
      socketRef.current.on('connected_devices', (data) => {
        if (data.devices?.length > 0) {
          const connectedDeviceIds = data.devices.map(d => d.id);
          
          // Initialize progress for newly connected devices
          setDeviceProgress(prev => {
            const newProgress = { ...prev };
            connectedDeviceIds.forEach(deviceId => {
              if (!newProgress[deviceId]) {
                newProgress[deviceId] = {
                  status: 'preparing',
                  progress: 0,
                  currentFile: '',
                  fileProgress: 0,
                  fileNumber: 0,
                  totalFiles: 0
                };
              }
            });
            return newProgress;
          });
        }
      });
    }
  }, [isTransferRunning]);

  const handleFileUpload = (uploadedFiles) => {
    Array.from(uploadedFiles).forEach(file => {
      // Check if file is already in uploadingFiles
      if (uploadingFiles.has(file.name)) {
        addLog(`File ${file.name} is already being uploaded`);
        return;
      }

      // Add file to uploading state
      setUploadingFiles(prev => new Set([...prev, file.name]));
      
      const formData = new FormData();
      formData.append('file', file);

      fetch('/transfer/upload_file', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
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
        // Remove file from uploading state
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(file.name);
          return next;
        });
        // Reset file input value
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
    });
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

  // Add function to remove failed transfer progress
  const removeFailedTransfer = (deviceId) => {
    setDeviceProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[deviceId];
      return newProgress;
    });
  };

  // Start transfer for all connected devices
  const startTransfer = () => {
    setIsTransferRunning(true);  // Only set by explicit start
    socketRef.current.emit('start_transfer');
    addLog('Starting file transfer...');
  };

  // Stop transfer for all devices
  const stopTransfer = () => {
    setIsTransferRunning(false);  // Only set by explicit stop
    socketRef.current.emit('stop_transfer');
    addLog('Stopping transfer...');
  };

  // Add a function to handle file deletion
  const handleFileDelete = async (filename) => {
    try {
      const response = await fetch('/transfer/delete_file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'success') {
        setFiles(prev => prev.filter(f => f !== filename));
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(filename);
          return next;
        });
        // Reset file input value after successful deletion
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
        socketRef={socketRef}
      />
    </div>
  );
}

export default Transfer; 