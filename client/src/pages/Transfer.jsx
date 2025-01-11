import React, { useState, useRef } from 'react';
import { FileUpload } from '../components/transfer/FileUpload';
import { TransferStatus } from '../components/transfer/TransferStatus';
import { TransferLog } from '../components/transfer/TransferLog';
import { TransferInfo } from '../components/transfer/TransferInfo';
import useFetch from '../components/shared/hooks/useFetch';

function Transfer() {
  // State management
  const [files, setFiles] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({ text: 'Waiting for device...', isConnected: false });
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [deviceProgress, setDeviceProgress] = useState({});
  const [logs, setLogs] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Set());

  const fileInputRef = useRef(null);
  const { get, post } = useFetch();

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

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

  const startTransfer = async () => {
    try {
      setIsTransferRunning(true);
      await fetch('/api/transfer/start', { method: 'POST' });
      addLog('Starting file transfer...');
    } catch (error) {
      console.error('Failed to start transfer:', error);
      addLog('Failed to start transfer');
      setIsTransferRunning(false);
    }
  };

  const stopTransfer = async () => {
    try {
      setIsTransferRunning(false);
      await fetch('/api/transfer/stop', { method: 'POST' });
      addLog('Stopping transfer...');
    } catch (error) {
      console.error('Failed to stop transfer:', error);
      addLog('Failed to stop transfer');
      setIsTransferRunning(true);
    }
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
    </div>
  );
}

export default Transfer; 