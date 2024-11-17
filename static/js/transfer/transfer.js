document.addEventListener('DOMContentLoaded', function () {
    //===========================================
    // Variable Declarations & Initialization 
    //===========================================
    let isConfiguring = false;
    let stopButtonClicked = false;
    let currentStep = 1;
    let isInstalling = false;
    let isTransferRunning = false;  // Track transfer state globally

    // Use globally available hooks
    const modal = useModal('popup-install-adb');
    const steps = useSteps(1);
    const process = useProcess();
    const mainTerminal = useTerminal('transfer-log');
    const adbTerminal = useTerminal('adb-terminal-output');
    
    // DOM Elements
    const elements = {
        startTransferBtn: document.querySelector('.start-transfer-btn'),
        stopTransferBtn: document.querySelector('.stop-transfer-btn'),
        deviceStatus: document.getElementById('device-status'),
        deviceProgressContainer: document.getElementById('device-progress-container'),
        transferLog: document.getElementById('transfer-log'),
        deviceProgressTemplate: document.getElementById('device-progress-template')?.content,
        fileInput: document.getElementById('file-input'),
        adbPopup: document.getElementById('popup-install-adb'),
        adbInstallBtn: document.getElementById('adb-install-btn'),
        adbReturnDashboardBtn: document.getElementById('adb-return-dashboard-btn'),
        adbNextBtn: document.getElementById('adb-next-btn'),
        adbCloseBtn: document.getElementById('adb-close-btn'),
        adbTerminalOutput: document.getElementById('popup-install-adb-terminal-output'),
        mainTerminalOutput: document.getElementById('transfer-log'),
        adbStepNotInstalled: document.getElementById('adb-step-not-installed'),
        adbStepInstalling: document.getElementById('adb-step-installing'),
        adbStepSuccess: document.getElementById('adb-step-success'),
        adbStepFailed: document.getElementById('adb-step-failed')
    };

    //===========================================
    // Socket Connection & Event Handlers
    //===========================================
    let socket;
    try {
        socket = io('/transfer', { transports: ['websocket'] });
        console.debug('Socket initialized');
        
        socket.on('connect', () => {
            console.debug('Socket connected');
            logMessage('Connected to server', 'main');
            socket.emit('get_connected_devices');
            socket.emit('get_transfer_status');
        });

        socket.on('disconnect', () => {
            console.debug('Socket disconnected');
            logMessage('Disconnected from server', 'main');
        });

        socket.on('connected_devices', (data) => {
            console.debug('Received connected devices:', data);
            if (data.devices && data.devices.length > 0) {
                const deviceList = data.devices.map(device => device.id).join(', ');
                
                elements.deviceStatus.textContent = `Connected devices: ${deviceList}`;
                elements.deviceStatus.classList.remove('text-yellow-500');
                elements.deviceStatus.classList.add('text-green-500');
                
                const currentDeviceIds = data.devices.map(device => device.id);
                const existingProgressBars = elements.deviceProgressContainer.querySelectorAll('.device-progress');
                
                existingProgressBars.forEach(progressBar => {
                    const deviceId = progressBar.dataset.deviceId;
                    if (!currentDeviceIds.includes(deviceId)) {
                        console.debug(`Removing progress bar for disconnected device: ${deviceId}`);
                        progressBar.remove();
                    }
                });
                
                if (data.hasOwnProperty('isTransferRunning')) {
                    isTransferRunning = data.isTransferRunning;
                    updateTransferButtons();
                }
            } else {
                elements.deviceStatus.textContent = 'Waiting for device...';
                elements.deviceStatus.classList.remove('text-green-500');
                elements.deviceStatus.classList.add('text-yellow-500');
                elements.deviceProgressContainer.innerHTML = ''; // Clear all progress elements
            }
        });

        socket.on('terminal_output', (data) => {
            console.debug('Received terminal output:', data.data);
            
            if (process.isRunning) {
                adbTerminal.append(data.data);
            } else {
                mainTerminal.append(data.data);
            }
            
            if (!process.isRunning && data.data.includes("No such file or directory: 'adb'")) {
                steps.goto(1);
                showCurrentStep();
                modal.open();
            }
        });

        socket.on('installation_started', () => {
            console.debug('Installation started');
            isInstalling = true;
            popupManager.startConfiguration();
            elements.adbNextBtn?.classList.add('hidden');
        });

        socket.on('installation_complete', (data) => {
            console.debug('Installation complete:', data);
            isInstalling = false;
            process.stop();
            popupManager.handleCompletion(true);
            elements.adbNextBtn?.classList.remove('hidden');
        });

        socket.on('installation_failed', (data) => {
            console.debug('Installation failed:', data.error);
            isInstalling = false;
            process.stop();
            popupManager.handleCompletion(false);
            elements.adbNextBtn?.classList.remove('hidden');
        });

        socket.on('transfer_status', (data) => {
            console.debug('Transfer status update:', data);
            
            // Update global transfer state
            if (data.hasOwnProperty('isRunning')) {
                isTransferRunning = data.isRunning;
                updateTransferButtons();
                
                // If transfer is stopped, clear progress bars
                if (!data.isRunning) {
                    clearProgressBars();
                }
            }
            
            // Handle device-specific status updates
            if (data.device_id && data.status) {
                updateDeviceProgress(data);
                
                if (data.status === 'completed') {
                    const statusMessage = `Transfer completed for device ${data.device_id}`;
                    logMessage(statusMessage, 'main');
                } else if (data.status === 'failed' || data.status === 'stopped') {
                    const statusMessage = `Transfer ${data.status} for device ${data.device_id}`;
                    logMessage(statusMessage, 'main');
                }
            }
        });

        socket.on('transfer_progress', (data) => {
            console.debug('Received transfer progress:', data);
            updateDeviceProgress(data);
        });

        socket.on('monitoring_started', () => {
            console.debug('Device monitoring started');
            logMessage('Device monitoring started', 'main');
        });

        socket.on('monitoring_stopped', () => {
            console.debug('Device monitoring stopped');
            logMessage('Device monitoring stopped', 'main');
        });

        socket.on('device_connected', (data) => {
            console.debug('Device connected event:', data);
            const deviceId = data.device_id;
            
            if (data.should_transfer) {
                logMessage(`New device connected (${deviceId}). Starting transfer...`, 'main');
                // Create progress bar for new device
                updateDeviceProgress({
                    device_id: deviceId,
                    status: 'starting',
                    progress: 0
                });
            } else {
                logMessage(`New device connected (${deviceId})`, 'main');
            }
        });

        socket.on('transfer_status', (data) => {
            console.debug('Transfer status update:', data);
            isTransferRunning = data.isRunning;
            updateTransferButtons(data.isRunning);
            
            if (data.device_id && data.status) {
                updateDeviceProgress(data);
            }
            
            // Handle transfer completion
            if (data.status === 'completed' || data.status === 'failed') {
                const statusMessage = `Transfer ${data.status} for device ${data.device_id}`;
                logMessage(statusMessage, 'main');
            }
        });

        socket.on('connected_devices', (data) => {
            console.debug('Connected devices update:', data);
            const devices = data.devices || [];
            
            // Update device status display
            if (devices.length > 0) {
                const deviceList = devices.map(device => device.id).join(', ');
                elements.deviceStatus.textContent = `Connected devices: ${deviceList}`;
                elements.deviceStatus.classList.remove('text-yellow-500');
                elements.deviceStatus.classList.add('text-green-500');
            } else {
                elements.deviceStatus.textContent = 'No devices connected';
                elements.deviceStatus.classList.remove('text-green-500');
                elements.deviceStatus.classList.add('text-yellow-500');
            }

            // Only update transfer status if explicitly provided
            if (data.hasOwnProperty('isTransferRunning')) {
                isTransferRunning = data.isTransferRunning;
                updateTransferButtons();
            }
        });

    } catch (error) {
        console.error('Error initializing socket:', error);
    }

    //===========================================
    // Utility Functions 
    //===========================================
    function logMessage(message, target) {
        console.debug('Logging message:', message, 'to target:', target);
        
        let outputElement;
        if (target === 'adb') {
            outputElement = document.getElementById('adb-terminal-output');
        } else {
            outputElement = document.getElementById('main-terminal-output');
        }
        
        if (outputElement) {
            const line = document.createElement('div');
            line.textContent = message;
            line.classList.add('select-text');
            outputElement.appendChild(line);
            outputElement.scrollTop = outputElement.scrollHeight;
        }
    }

    function hideAllButtons() {
        console.debug('Hiding all buttons');
        [elements.adbReturnDashboardBtn, elements.adbNextBtn, elements.adbCloseBtn, elements.adbInstallBtn]
            .forEach(btn => {
                if (btn) {
                    console.debug('Hiding button:', btn);
                    btn.classList.add('hidden');
                } else {
                    console.warn('Button not found in elements');
                }
            });
    }

    function hideAllSteps() {
        console.debug('Hiding all steps');
        const steps = document.querySelectorAll('.adb-step');
        console.debug('Found steps:', steps);
        steps.forEach(step => {
            console.debug('Hiding step:', step.id);
            step.classList.add('hidden');
        });
    }

    function showCurrentStep() {
        console.debug('Showing current step:', currentStep);
        console.debug('Installation status:', isInstalling);
        
        hideAllSteps();
        hideAllButtons();
        
        switch (currentStep) {
            case 1:
                elements.adbStepNotInstalled?.classList.remove('hidden');
                elements.adbReturnDashboardBtn?.classList.remove('hidden');
                elements.adbInstallBtn?.classList.remove('hidden');
                break;
            case 2:
                elements.adbStepInstalling?.classList.remove('hidden');
                if (!isInstalling && process.isComplete) {
                    elements.adbNextBtn?.classList.remove('hidden');
                }
                break;
            case 3:
                elements.adbStepSuccess?.classList.remove('hidden');
                elements.adbCloseBtn?.classList.remove('hidden');
                break;
            case 4:
                elements.adbStepFailed?.classList.remove('hidden');
                elements.adbReturnDashboardBtn?.classList.remove('hidden');
                break;
        }
    }

    //===========================================
    // Popup Step Management
    //===========================================
    class PopupStepManager {
        constructor(popupId) {
            this.modal = useModal(popupId);
            this.process = useProcess();
            this.terminal = useTerminal(popupId + '-terminal-output');
            this.socket = socket;
            this.isSuccess = true;
            this.isComplete = false;
        }

        showStep(step) {
            currentStep = step;
            showCurrentStep();
        }

        handleCompletion(success) {
            this.process.stop();
            this.isSuccess = success;
            this.isComplete = true;
            isInstalling = false;
            
            if (success) {
                this.terminal.append('ADB installation completed successfully.');
            } else {
                this.terminal.append('ADB installation failed.');
            }
            elements.adbNextBtn?.classList.remove('hidden');
        }

        startConfiguration() {
            this.process.start('adb-install');
            isInstalling = true;
            this.showStep(2);
            elements.adbNextBtn?.classList.add('hidden');
        }

        closePopup() {
            this.modal.close();
            this.process.stop();
            window.location.reload();
        }
    }

    const popupManager = new PopupStepManager('popup-install-adb');

    //===========================================
    // ADB Management Functions
    //===========================================
    function checkAdbInstallation() {
        console.debug('Checking ADB installation');
        fetch('/check_adb')
            .then(response => response.json())
            .then(data => {
                console.debug('ADB check response:', data);
                if (data.status === 'ADB is not installed') {
                    currentStep = 1;
                    showCurrentStep();
                    elements.adbPopup.classList.remove('hidden');
                    document.body.classList.add('overflow-hidden');
                }
            })
            .catch(error => {
                console.error('Error checking ADB installation:', error);
                logMessage('Error checking ADB installation', 'main');
            });
    }

    function installAdb() {
        console.debug('Installing ADB');
        
        process.start('adb-install');
        isInstalling = true;
        adbTerminal.clear();
        popupManager.showStep(2);

        fetch('/install_adb', { method: 'POST' })
            .catch(error => {
                console.error('Error installing ADB:', error);
                isInstalling = false;
                handleInstallationError(error.message);
            });
    }

    function handleInstallationError(message) {
        isConfiguring = false;
        stopButtonClicked = true;
        logMessage(`Installation failed: ${message}`, 'adb');
        elements.adbReturnDashboardBtn?.classList.remove('hidden');
    }

    //===========================================
    // File Upload Management
    //===========================================
    function handleFileUpload(files) {
        Array.from(files).forEach(file => {
            const formData = new FormData();
            formData.append('file', file);

            fetch('/upload_file', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    addFileToList(file.name);
                    logMessage(`Uploaded ${file.name} successfully`, 'main');
                } else {
                    logMessage(`Error uploading ${file.name}: ${data.error}`, 'main');
                }
            })
            .catch(error => {
                logMessage(`Error uploading ${file.name}: ${error}`, 'main');
            });
        });
    }

    function addFileToList(filename) {
        const fileList = document.getElementById('file-list');
        const template = document.getElementById('file-item-template');
        
        if (fileList && template) {
            fileList.classList.remove('hidden');
            const clone = document.importNode(template.content, true);
            
            const fileNameSpan = clone.querySelector('span');
            fileNameSpan.textContent = filename;
            
            const removeButton = clone.querySelector('button');
            removeButton.dataset.filename = filename;
            removeButton.addEventListener('click', () => removeFile(filename));
            
            fileList.appendChild(clone);
        }
    }

    function removeFile(filename) {
        const fileItem = document.querySelector(`button[data-filename="${filename}"]`).parentNode;
        fileItem.remove();
        
        const fileList = document.getElementById('file-list');
        if (fileList && fileList.children.length === 0) {
            fileList.classList.add('hidden');
        }
        
        logMessage(`Removed ${filename} from upload list`, 'main');
    }

    //===========================================
    // Event Listeners
    //===========================================
    elements.startTransferBtn?.addEventListener('click', () => {
        console.debug('Start transfer button clicked');
        clearProgressBars();
        isTransferRunning = true;
        socket.emit('start_transfer');
        updateTransferButtons();
        logMessage('Starting file transfer...', 'main');
    });

    elements.stopTransferBtn?.addEventListener('click', () => {
        console.debug('Stop transfer button clicked');
        
        // Disable the button immediately
        elements.stopTransferBtn.disabled = true;
        
        // Reset local state
        isTransferRunning = false;
        clearProgressBars();
        
        // Stop monitoring and transfer on server
        socket.emit('stop_monitoring');
        socket.emit('stop_transfer');
        
        // Wait briefly for server to process the stop commands
        setTimeout(() => {
            // Force a clean reload of the page
            window.location.reload(true);
        }, 1500); // Increased timeout to ensure server has time to cleanup
    });

    elements.adbReturnDashboardBtn?.addEventListener('click', () => {
        window.location.href = '/';
    });

    elements.adbInstallBtn?.addEventListener('click', () => {
        installAdb();
    });

    elements.adbNextBtn?.addEventListener('click', () => {
        console.debug('Next button clicked. isComplete:', popupManager.isComplete, 'isSuccess:', popupManager.isSuccess);
        if (popupManager.isComplete) {
            currentStep = popupManager.isSuccess ? 3 : 4;
            showCurrentStep();
        }
    });

    elements.adbCloseBtn?.addEventListener('click', () => {
        popupManager.closePopup();
    });

    elements.fileInput?.addEventListener('change', (event) => {
        handleFileUpload(event.target.files);
        event.target.value = '';
    });

    // Drag and drop handling
    const dropZone = document.querySelector('.border-dashed');
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('border-green-500');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-green-500');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('border-green-500');
            const files = e.dataTransfer.files;
            handleFileUpload(files);
        });
    }

    //===========================================
    // Initialize
    //===========================================
    checkAdbInstallation();
    socket.emit('get_connected_devices');
    socket.emit('start_monitoring');

    // Add event listener for page unload
    window.addEventListener('beforeunload', (event) => {
        if (isTransferRunning) {
            socket.emit('stop_transfer');
            socket.emit('stop_monitoring');
        }
    });

    // Helper function to clear progress bars
    function clearProgressBars() {
        console.debug('Clearing progress bars');
        if (elements.deviceProgressContainer) {
            elements.deviceProgressContainer.innerHTML = '';
        }
        // Also reset device status
        if (elements.deviceStatus) {
            elements.deviceStatus.textContent = 'Waiting for device...';
            elements.deviceStatus.classList.remove('text-green-500');
            elements.deviceStatus.classList.add('text-yellow-500');
        }
    }

    // Helper function to update transfer buttons state
    function updateTransferButtons() {
        console.debug('Updating transfer buttons. Transfer running:', isTransferRunning);
        if (elements.startTransferBtn && elements.stopTransferBtn) {
            elements.startTransferBtn.classList.toggle('hidden', isTransferRunning);
            elements.stopTransferBtn.classList.toggle('hidden', !isTransferRunning);
            
            // Ensure buttons are enabled/disabled appropriately
            elements.startTransferBtn.disabled = isTransferRunning;
            elements.stopTransferBtn.disabled = !isTransferRunning;
        } else {
            console.warn('Transfer buttons not found in elements');
        }
    }

    // Update the progress update function to handle both file and overall progress
    function updateDeviceProgress(data) {
        const deviceId = data.device_id;
        let progressElement = document.querySelector(`.device-progress[data-device-id="${deviceId}"]`);
        
        // Create new progress element if it doesn't exist
        if (!progressElement && elements.deviceProgressTemplate) {
            const clone = document.importNode(elements.deviceProgressTemplate, true);
            const progressDiv = clone.querySelector('.device-progress');
            progressDiv.dataset.deviceId = deviceId;
            elements.deviceProgressContainer?.appendChild(clone);
            progressElement = progressDiv;
        }
        
        if (progressElement) {
            const progressBar = progressElement.querySelector('.progress-bar');
            const progressText = progressElement.querySelector('.progress-text');
            const deviceLabel = progressElement.querySelector('.device-label');
            const statusLabel = progressElement.querySelector('.status-label');
            
            // Use overall_progress if available, otherwise use regular progress
            const progressValue = data.overall_progress !== undefined ? 
                data.overall_progress : data.progress;
            
            // Update progress bar width and text
            if (progressBar && progressValue !== undefined) {
                progressBar.style.width = `${progressValue}%`;
                progressBar.classList.remove('bg-yellow-500', 'bg-green-500', 'bg-red-500', 'bg-blue-500');
                
                // Set color based on status
                switch(data.status) {
                    case 'preparing':
                    case 'starting':
                        progressBar.classList.add('bg-yellow-500');
                        break;
                    case 'completed':
                        progressBar.classList.add('bg-green-500');
                        break;
                    case 'failed':
                        progressBar.classList.add('bg-red-500');
                        break;
                    case 'transferring':
                        progressBar.classList.add('bg-blue-500');
                        break;
                    default:
                        progressBar.classList.add('bg-yellow-500');
                }
            }
            
            // Update text elements
            if (progressText) {
                if (progressValue !== undefined) {
                    if (data.file_progress !== undefined) {
                        const fileNumber = data.current_file_number || 1;
                        const totalFiles = data.total_files || 1;
                        progressText.textContent = `${progressValue}% (File ${fileNumber}/${totalFiles}: ${data.file_progress}%)`;
                    } else {
                        progressText.textContent = `${progressValue}%`;
                    }
                } else {
                    progressText.textContent = ''; // Clear text if no percentage available
                }
            }
            
            if (deviceLabel) deviceLabel.textContent = `Device: ${deviceId}`;
            if (statusLabel) {
                statusLabel.textContent = data.current_file ? 
                    `${data.status} - ${data.current_file}` : 
                    data.status;
            }
            
            // Update log message to avoid undefined
            const progressMessage = data.status + 
                (data.current_file ? ` - ${data.current_file}` : '') +
                (progressValue !== undefined ? ` - ${progressValue}%` : '') +
                (data.file_progress !== undefined ? ` (File: ${data.file_progress}%)` : '');
            
            logMessage(`Transfer progress for device ${deviceId}: ${progressMessage}`, 'main');
            
            // Add connecting state handling
            if (data.status === 'connecting') {
                progressBar.classList.add('bg-yellow-500', 'animate-pulse');
                statusLabel.textContent = 'Connecting...';
            }
        } else {
            console.warn('Failed to create or find progress element for device:', deviceId);
        }
    }

    // Add this near the initialization section
    function initializeAfterStop() {
        console.debug('Initializing after stop');
        clearProgressBars();
        checkAdbInstallation();
        socket.emit('get_connected_devices');
        socket.emit('get_transfer_status');
        socket.emit('start_monitoring');
    }
});
