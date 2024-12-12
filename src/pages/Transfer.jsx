import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import AdbInstallation from '../components/transfer/AdbInstallation';
import { FileUpload } from '../components/transfer/FileUpload';
import { TransferStatus } from '../components/transfer/TransferStatus';
import { TransferLog } from '../components/transfer/TransferLog';

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
      socketRef.current.emit('get_connected_devices');
      socketRef.current.emit('get_transfer_status');
    });

    // Update device list and handle progress bars
    socketRef.current.on('connected_devices', (data) => {
      if (data.devices?.length > 0) {
        const deviceList = data.devices.map(device => device.id).join(', ');
        setDeviceStatus({
          text: `Connected devices: ${deviceList}`,
          isConnected: true
        });

        // Handle progress bars for all devices
        setDeviceProgress(prev => {
          const newProgress = { ...prev };
          const connectedDeviceIds = data.devices.map(d => d.id);
          
          // Remove completed progress bars for disconnected devices
          // and remove failed progress bars for reconnected devices
          Object.keys(newProgress).forEach(deviceId => {
            if (!connectedDeviceIds.includes(deviceId)) {
              // Remove if device is disconnected and transfer was completed
              if (newProgress[deviceId].status === 'completed') {
                delete newProgress[deviceId];
              }
            } else {
              // If device is connected and was previously failed, remove it
              if (newProgress[deviceId]?.status === 'failed') {
                delete newProgress[deviceId];
              }
            }
          });
          
          return newProgress;
        });
      } else {
        setDeviceStatus({
          text: 'Waiting for device...',
          isConnected: false
        });
        
        // Only clean up completed transfers when no devices are connected
        setDeviceProgress(prev => {
          const newProgress = { ...prev };
          Object.keys(newProgress).forEach(deviceId => {
            if (newProgress[deviceId].status === 'completed') {
              delete newProgress[deviceId];
            }
          });
          return newProgress;
        });
      }
    });

    // Handle individual device progress updates
    socketRef.current.on('transfer_progress', (data) => {
      const { device_id, current_file, file_progress, overall_progress, status, current_file_number, total_files } = data;
      
      setDeviceProgress(prev => {
        // Don't update if the device is already in failed state
        if (prev[device_id]?.status === 'failed') {
          return prev;
        }
        
        return {
          ...prev,
          [device_id]: {
            progress: overall_progress,
            status,
            currentFile: current_file,
            fileProgress: file_progress,
            fileNumber: current_file_number,
            totalFiles: total_files
          }
        };
      });

      if (status === 'completed') {
        addLog(`Transfer completed for device ${device_id}`);
      }
    });

    // Handle transfer status updates
    socketRef.current.on('transfer_status', (data) => {
      setIsTransferRunning(data.isRunning);
      
      if (data.status === 'starting') {
        addLog('Transfer started');
      } else if (data.status === 'stopped') {
        addLog('Transfer stopped');
        setDeviceProgress({});
      } else if (data.status === 'failed' && data.device_id) {
        // Update the specific device's progress to show failed state
        setDeviceProgress(prev => ({
          ...prev,
          [data.device_id]: {
            ...prev[data.device_id],
            status: 'failed',
            currentFile: data.current_file,
            // Preserve the last progress percentage
            progress: prev[data.device_id]?.progress || 0
          }
        }));
        addLog(`Transfer failed for device ${data.device_id}`);
      }
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
        socketRef.current.disconnect();
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
    setIsTransferRunning(true);
    socketRef.current.emit('start_transfer');
    addLog('Starting file transfer...');
  };

  // Stop transfer for all devices
  const stopTransfer = () => {
    setIsTransferRunning(false);
    socketRef.current.emit('stop_transfer');
    addLog('Stopping transfer...');
    
    setTimeout(() => {
      setDeviceProgress({});
      setDeviceStatus({ text: 'Waiting for device...', isConnected: false });
      
      // Instead of disconnecting and reconnecting the socket,
      // just re-request the device list
      if (socketRef.current) {
        socketRef.current.emit('get_connected_devices');
        socketRef.current.emit('get_transfer_status');
      }
    }, 1000);
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