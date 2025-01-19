import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from '../components/transfer/FileUpload';
import { TransferStatus } from '../components/transfer/TransferStatus';
import { TransferLog } from '../components/transfer/TransferLog';
import { TransferInfo } from '../components/transfer/TransferInfo';

function Transfer() {
  // State management
  const [files, setFiles] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({ text: 'Waiting for device...', isConnected: false });
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [deviceProgress, setDeviceProgress] = useState({});
  const [logs, setLogs] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Set());

  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);

  const addLog = (message) => {
    setLogs(prev => [...prev, { message, timestamp: new Date().toISOString() }]);
  };

  // Setup SSE connection
  useEffect(() => {
    const setupEventSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      eventSourceRef.current = new EventSource('/api/transfer/transfer-status-stream');

      // Handle connection open
      eventSourceRef.current.onopen = () => {
        addLog('Connected to server');
      };

      // Handle messages
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transfer_status') {
            // Update transfer status
            setIsTransferRunning(data.isRunning);
            
            if (data.device_id) {
              // Update device-specific progress
              setDeviceProgress(prev => ({
                ...prev,
                [data.device_id]: {
                  progress: data.progress,
                  status: data.status,
                  currentFile: data.device_progress?.current_file,
                  filesCompleted: data.device_progress?.files_completed,
                  totalFiles: data.device_progress?.total_files
                }
              }));

              // Update device connection status
              if (data.status === 'device_connected') {
                setDeviceStatus({
                  text: `Device connected: ${data.device_id}`,
                  isConnected: true
                });
              } else if (data.status === 'device_disconnected') {
                setDeviceStatus({
                  text: 'Waiting for device...',
                  isConnected: false
                });
              }
            }

            // Add log message if provided
            if (data.message) {
              addLog(data.message);
            }

            // Handle errors
            if (data.error) {
              addLog(`Error: ${data.error}`);
              console.error('Transfer error:', data.error);
            }
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
          addLog(`Error parsing server message: ${error.message}`);
        }
      };

      // Handle errors
      eventSourceRef.current.onerror = (error) => {
        console.error('SSE Error:', error);
        addLog('Lost connection to server. Attempting to reconnect...');
        
        // Close current connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Attempt to reconnect after delay
        setTimeout(setupEventSource, 5000);
      };
    };

    // Start SSE connection
    setupEventSource();

    // Start device monitoring
    const startMonitoring = async () => {
      try {
        const response = await fetch('/api/transfer/start-monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
          addLog('Started device monitoring');
        } else {
          throw new Error(data.message || 'Failed to start monitoring');
        }
      } catch (error) {
        console.error('Failed to start monitoring:', error);
        addLog(`Failed to start device monitoring: ${error.message}`);
      }
    };
    
    startMonitoring();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleFileUpload = async (uploadedFiles) => {
    const filesToUpload = Array.from(uploadedFiles).filter(file => !uploadingFiles.has(file.name));
    
    if (filesToUpload.length === 0) {
      addLog('No new files to upload');
      return;
    }

    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append('files', file);
      setUploadingFiles(prev => new Set([...prev, file.name]));
    });

    try {
      const response = await fetch('/api/transfer/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setFiles(prev => {
          const newFiles = new Set([...prev]);
          data.files.forEach(file => newFiles.add(file));
          return Array.from(newFiles);
        });
        addLog(`Successfully uploaded ${data.files.length} file(s)`);
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      addLog(`Error uploading files: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      filesToUpload.forEach(file => {
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(file.name);
          return next;
        });
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFailedTransfer = (deviceId) => {
    setDeviceProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[deviceId];
      return newProgress;
    });
  };

  const startTransfer = async () => {
    try {
      const response = await fetch('/api/transfer/start-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setIsTransferRunning(true);
        addLog(`Starting transfer to ${data.devices.length} device(s)`);
      } else {
        throw new Error(data.message || 'Failed to start transfer');
      }
    } catch (error) {
      console.error('Failed to start transfer:', error);
      addLog(`Failed to start transfer: ${error.message}`);
      setIsTransferRunning(false);
    }
  };

  const stopTransfer = async () => {
    try {
      const response = await fetch('/api/transfer/stop-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setIsTransferRunning(false);
        addLog('Transfer stopped');
      } else {
        throw new Error(data.message || 'Failed to stop transfer');
      }
    } catch (error) {
      console.error('Failed to stop transfer:', error);
      addLog(`Failed to stop transfer: ${error.message}`);
    }
  };

  const handleFileDelete = async (filename) => {
    try {
      const response = await fetch('/api/transfer/delete-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setFiles(prev => prev.filter(f => f !== filename));
        addLog(`Deleted ${filename}`);
      } else {
        throw new Error(data.message || 'Delete failed');
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
    </div>
  );
}

export default Transfer; 