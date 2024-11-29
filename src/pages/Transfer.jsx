import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Add the missing SVG for file upload
const UploadIcon = () => (
  <svg className="mx-auto h-4 w-4 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// Add the delete icon for file list
const DeleteIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

// Update the Button component to match the template exactly
const Button = ({ text, hoverColor = "green", type = "button", additionalClasses = "", onClick, disabled }) => (
  <button 
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`
      text-buttonTextColor 
      rounded-lg 
      p-2 
      text-sm 
      border-1 
      border-buttonBorder 
      bg-buttonColor 
      hover:text-black 
      hover:shadow-soft 
      hover:border-black 
      hover:shadow-black 
      hover:bg-${hoverColor}-500 
      transition-colors
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${additionalClasses}
    `.replace(/\s+/g, ' ').trim()}
  >
    {text}
  </button>
);

function Transfer() {
  // State management
  const [files, setFiles] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({ text: 'Waiting for device...', isConnected: false });
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [progressBars, setProgressBars] = useState({});
  const [logs, setLogs] = useState([]);

  // Additional state
  const [adbInstallation, setAdbInstallation] = useState({
    isInstalling: false,
    currentStep: 1,
    isComplete: false,
    isSuccess: true
  });
  const [deviceProgress, setDeviceProgress] = useState({});

  // Refs
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const transferLogRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('/transfer', { transports: ['websocket'] });
    
    // Socket event handlers
    socketRef.current.on('connect', () => {
      addLog('Connected to server');
      socketRef.current.emit('get_connected_devices');
      socketRef.current.emit('get_transfer_status');
    });

    socketRef.current.on('connected_devices', (data) => {
      if (data.devices?.length > 0) {
        const deviceList = data.devices.map(device => device.id).join(', ');
        setDeviceStatus({
          text: `Connected devices: ${deviceList}`,
          isConnected: true
        });
      } else {
        setDeviceStatus({
          text: 'Waiting for device...',
          isConnected: false
        });
      }
    });

    // Cleanup
    return () => {
      if (isTransferRunning) {
        socketRef.current.emit('stop_transfer');
        socketRef.current.emit('stop_monitoring');
      }
      socketRef.current.disconnect();
    };
  }, []);

  const handleFileUpload = (uploadedFiles) => {
    Array.from(uploadedFiles).forEach(file => {
      const formData = new FormData();
      formData.append('file', file);

      fetch('/upload_file', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          setFiles(prev => [...prev, file.name]);
          addLog(`Uploaded ${file.name} successfully`);
        }
      })
      .catch(error => addLog(`Error uploading ${file.name}: ${error}`));
    });
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
    if (transferLogRef.current) {
      transferLogRef.current.scrollTop = transferLogRef.current.scrollHeight;
    }
  };

  const updateDeviceProgress = (data) => {
    const { device_id, status, progress, overall_progress, current_file, file_progress, current_file_number, total_files } = data;
    
    setDeviceProgress(prev => ({
      ...prev,
      [device_id]: {
        progress: overall_progress !== undefined ? overall_progress : progress,
        status,
        currentFile: current_file,
        fileProgress: file_progress,
        fileNumber: current_file_number,
        totalFiles: total_files
      }
    }));
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* File Upload Section - Update styling */}
      <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
        <h2 className="text-base mb-4">File Upload</h2>
        <div className="flex flex-col gap-4">
          <div 
            className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-green-500');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-green-500');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-green-500');
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <input
              id="file-input"  // Add id for label
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".zip,.jpg,.jpeg,.png,.tif,.tiff,.p12,.apk,.sid"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <UploadIcon />
              <p className="mt-1">Drop files here or click to select</p>
              <p className="text-sm text-gray-400">
                Supported files: .zip, .jpg, .jpeg, .png, .tif, .tiff, .p12, .apk, .sid
              </p>
            </label>
          </div>

          {/* Update file list styling */}
          {files.length > 0 && (
            <div id="file-list" className="space-y-2 text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor">
              {files.map((filename) => (
                <div key={filename} className="flex justify-between items-center p-2 rounded-lg">
                  <span className="text-buttonTextColor">{filename}</span>
                  <button
                    onClick={() => setFiles(prev => prev.filter(f => f !== filename))}
                    className="text-red-500 hover:text-red-700 hover:shadow-soft"
                    data-filename={filename}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Status Section - Update button styling */}
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
              <div key={deviceId} className="device-progress bg-buttonColor border-1 border-buttonBorder rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-white">Device: {deviceId}</span>
                  <span className="text-sm font-medium text-white">
                    {progress.progress}%
                    {progress.fileProgress !== undefined && 
                      ` (File ${progress.fileNumber}/${progress.totalFiles}: ${progress.fileProgress}%)`}
                  </span>
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
                    {progress.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Update button styling */}
          <div className="flex gap-4">
            <Button
              text="Start Transfer"
              hoverColor="green"
              onClick={() => {
                setIsTransferRunning(true);
                socketRef.current.emit('start_transfer');
                addLog('Starting file transfer...');
              }}
              disabled={isTransferRunning}
              additionalClasses={isTransferRunning ? 'hidden' : ''}
            />
            <Button
              text="Stop Transfer"
              hoverColor="red"
              onClick={() => {
                setIsTransferRunning(false);
                socketRef.current.emit('stop_monitoring');
                socketRef.current.emit('stop_transfer');
                setTimeout(() => window.location.reload(), 1500);
              }}
              disabled={!isTransferRunning}
              additionalClasses={!isTransferRunning ? 'hidden' : ''}
            />
          </div>
        </div>
      </div>

      {/* Transfer Log Section - Update title styling */}
      <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
        <h2 className="text-base mb-4">Transfer Log</h2>
        <div 
          ref={transferLogRef}
          className="list-none space-y-2 overflow-y-auto text-textSecondary text-sm border border-accentBoarder h-64 p-2 rounded-lg mt-4"
        >
          {logs.map((log, index) => (
            <div key={index} className="select-text">{log}</div>
          ))}
        </div>
      </div>

      {/* ADB Installation Modal - Update modal styling */}
      {adbInstallation.currentStep > 0 && (
        <div className="fixed inset-y-0 right-0 left-64 flex items-center justify-center z-50">
          {/* Background Overlay with Blur Effect - adjusted to match sidebar width */}
          <div className="fixed inset-y-0 right-0 left-64 bg-black bg-opacity-50 backdrop-filter backdrop-blur-sm"></div>
          
          {/* Popup Content */}
          <div className="bg-cardBg border-1 border-accentBoarder p-6 rounded-lg shadow-lg max-w-lg w-full text-white relative z-10 flex flex-col items-center mx-4">
            <div className="popup-content text-sm overflow-y-auto max-w-full p-2 max-h-96 flex-grow flex justify-center items-start">
              <div className="w-full max-w-lg">
                {/* Step 1: Not Installed */}
                {adbInstallation.currentStep === 1 && (
                  <div className="text-center">
                    <h3 className="text-lg mb-4">ADB Not Installed</h3>
                    <p className="mb-4">Android Debug Bridge (ADB) is required for device communication.</p>
                    <div className="flex justify-center space-x-2 w-full">
                      <Button
                        text="Return to Dashboard"
                        hoverColor="gray"
                        onClick={() => window.location.href = '/'}
                      />
                      <Button
                        text="Install ADB"
                        hoverColor="blue"
                        onClick={() => {
                          setAdbInstallation(prev => ({ ...prev, isInstalling: true, currentStep: 2 }));
                          fetch('/install_adb', { method: 'POST' });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Installing */}
                {adbInstallation.currentStep === 2 && (
                  <div className="text-center">
                    <h3 className="text-lg mb-4">Installing ADB</h3>
                    <div id="adb-terminal-output" className="list-none space-y-2 overflow-y-auto text-textSecondary text-sm border border-accentBoarder h-64 p-2 rounded-lg mt-4">
                      {/* Terminal output would go here */}
                    </div>
                    {!adbInstallation.isInstalling && (
                      <div className="flex justify-center mt-4 space-x-2 w-full">
                        <Button
                          text="Next"
                          hoverColor="blue"
                          onClick={() => setAdbInstallation(prev => ({
                            ...prev,
                            currentStep: prev.isSuccess ? 3 : 4
                          }))}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Success */}
                {adbInstallation.currentStep === 3 && (
                  <div className="text-center">
                    <h3 className="text-lg mb-4">Installation Complete</h3>
                    <p className="mb-4">ADB has been successfully installed.</p>
                    <div className="flex justify-center mt-4 space-x-2 w-full">
                      <Button
                        text="Close"
                        hoverColor="green"
                        onClick={() => window.location.reload()}
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Failed */}
                {adbInstallation.currentStep === 4 && (
                  <div className="text-center">
                    <h3 className="text-lg mb-4">Installation Failed</h3>
                    <p className="mb-4">Failed to install ADB. Please try again or contact support.</p>
                    <div className="flex justify-center mt-4 space-x-2 w-full">
                      <Button
                        text="Return to Dashboard"
                        hoverColor="red"
                        onClick={() => window.location.href = '/'}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transfer; 