document.addEventListener('DOMContentLoaded', function () {
    // Variables for the OTA Updates configuration popup
    const configureOtaUpdatesBtn = document.getElementById('install-ota-updates-btn');
    const popupId = 'popup-configure-ota-updates';
    const popupModal = document.getElementById(popupId);
    const popupCloseBtn = document.getElementById(`${popupId}-close-btn`);
    const popupBackBtn = document.getElementById(`${popupId}-back-btn`);
    const popupNextBtn = document.getElementById(`${popupId}-next-btn`);
    const popupStopBtn = document.getElementById(`${popupId}-stop-btn`);
    const popupStartInstallBtn = document.getElementById(`${popupId}-start-install-btn`);
    const popupTerminalOutput = document.getElementById(`${popupId}-terminal-output`);
    let isConfiguring = false;  // Track if configuration is in progress
    let currentStep = 1;        // Track the current step
    let stopButtonClicked = false; // Track if the stop button has been clicked
    let configurationId = null; // Store the configuration ID

    // Step elements
    const step1 = document.getElementById('ota-updates-step-1');
    const step2 = document.getElementById('ota-updates-step-2');
    const step3 = document.getElementById('ota-updates-step-3');
    const step4 = document.getElementById('ota-updates-step-4');

    // Function to append text to terminal output
    function appendToTerminalOutput(text) {
        const newLine = document.createElement('div');
        newLine.textContent = text;
        newLine.classList.add('select-text');  // Allow text selection
        popupTerminalOutput.appendChild(newLine);
        popupTerminalOutput.scrollTop = popupTerminalOutput.scrollHeight; // Auto-scroll
    }

    function closePopup() {
        popupModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        isConfiguring = false;
        window.location.reload();
    }

    // Show current step
    function showCurrentStep() {
        hideAllButtons();
        hideAllSteps();

        if (currentStep === 1) {
            step1.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
            popupNextBtn.classList.remove('hidden');

        } else if (currentStep === 2) {
            step2.classList.remove('hidden');
            popupBackBtn.classList.remove('hidden');
            popupStartInstallBtn.classList.remove('hidden');
            popupCloseBtn.classList.add('hidden');
        } else if (currentStep === 3) {
            step3.classList.remove('hidden');
            if (isConfiguring && !stopButtonClicked) {
                popupStopBtn.classList.remove('hidden');
            }
            popupCloseBtn.classList.remove('hidden');
        } else if (currentStep === 4) {
            step4.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
        }
    }
    // Function to hide all buttons
    function hideAllButtons() {
        popupBackBtn.classList.add('hidden');
        popupNextBtn.classList.add('hidden');
        popupStopBtn.classList.add('hidden');
        popupCloseBtn.classList.add('hidden');
        popupStartInstallBtn.classList.add('hidden');
    }
    // Function to hide all steps
    function hideAllSteps() {
        step1.classList.add('hidden');
        step2.classList.add('hidden');
        step3.classList.add('hidden');
        step4.classList.add('hidden');
    }

    // Event Listeners
    if (configureOtaUpdatesBtn) {
        configureOtaUpdatesBtn.addEventListener('click', function() {
            popupModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
            currentStep = 1;
            showCurrentStep();
        });
    }
    popupCloseBtn.addEventListener('click', closePopup);

    // Logic for Back Button
    popupBackBtn.addEventListener('click', function () {
        if (currentStep === 2) {
            currentStep = 1; // Move from step 2 to step 1
            showCurrentStep();
        } else if (currentStep === 3) {
            currentStep = 2; // Move from step 3 to step 2
            showCurrentStep();
        } else if (currentStep === 4) {
            currentStep = 3; // Move from step 4 to step 3
            showCurrentStep();
        } else {
            closePopup();
        }
    });

    // Logic for Next Button
    popupNextBtn.addEventListener('click', function () {
        if (currentStep === 1) {
            currentStep = 2; // Move from step 1 to step 2
            showCurrentStep();
        } else if (currentStep === 2) {
            currentStep = 3; // Move from step 2 to step 3
            showCurrentStep();
        } else if (currentStep === 3) {
            currentStep = 4; // Move from step 3 to step 4
            showCurrentStep();
        }
    });

    // Logic for Stop Button
    popupStopBtn.addEventListener('click', function () {
        if (isConfiguring && configurationId) {
            // Hide the stop button immediately after it's clicked
            stopButtonClicked = true; // Mark that the stop button has been clicked
            popupStopBtn.classList.add('hidden');
            popupStopBtn.disabled = true; // Ensure the stop button is disabled

            // If configuration is in progress, trigger rollback
            appendToTerminalOutput('Stopping configuration and rolling back...');
            fetch('/rollback-ota-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ configuration_id: configurationId })
            })
            .then(response => response.json())
            .then(data => {
                appendToTerminalOutput(data.message || data.error);
                // Wait for backend to emit completion via WebSocket
            })
            .catch(error => {
                appendToTerminalOutput(`Error during rollback: ${error}`);
                handleCompletion('failure');  // Handle rollback failure
            });
        }
    });

    // Logic for Begin Button
    popupStartInstallBtn.addEventListener('click', function () {
        console.log('Begin button clicked'); // Debugging log

        // Get the file input element
        const otaZipFileInput = document.getElementById('ota-zip-file');
        const otaZipFile = otaZipFileInput.files[0];

        if (!otaZipFile) {
            appendToTerminalOutput('Please select an OTA zip file before starting.');
            return;
        }

        console.log('Proceeding with configuration'); // Debugging log

        // Disable the start button during configuration
        popupStartInstallBtn.disabled = true;

        // Move to step 3
        currentStep = 3;
        showCurrentStep();

        appendToTerminalOutput('Starting OTA Updates configuration...');
        isConfiguring = true;  // Mark that the configuration is in progress

        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('ota_zip_file', otaZipFile);

        // Trigger OTA Updates configuration
        fetch('/setup-ota-update', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('Response data:', data); // Debugging log
            if (data.configuration_id) {
                configurationId = data.configuration_id; // Store the configuration ID
            } else {
                appendToTerminalOutput(data.message || data.error);
                handleCompletion('failure');  // Handle failure
            }
        })
        .catch(error => {
            console.error('Fetch error:', error); // Debugging log
            appendToTerminalOutput(`Error: ${error}`);
            handleCompletion('failure');  // Handle failure
        });
    });

    // Function to handle completion or failure
    function handleCompletion(status) {
        isConfiguring = false;
        popupStopBtn.classList.add('hidden'); // Always hide the Stop button when configuration is complete

        if (status === 'success') {
            appendToTerminalOutput('Configuration completed successfully.');
            popupNextBtn.classList.remove('hidden'); // Show Next button on success
            popupCloseBtn.classList.add('hidden');   // Hide Close button on success
        } else if (status === 'failure') {
            appendToTerminalOutput('Configuration failed.');
            popupNextBtn.classList.add('hidden');    // Hide Next button on failure
            popupCloseBtn.classList.remove('hidden'); // Show Close button on failure
        }
    }

    // Connect to Socket.IO
    const otaUpdateSocket = io('/ota-update', { transports: ['websocket'] });

    // Add console logs to capture socket events
    console.log('Connected to OTA update socket');
    otaUpdateSocket.on('connect', function () {
        console.log('Connected to OTA update server');
    });

    // Listen for terminal output events
    otaUpdateSocket.on('terminal_output', function (data) {
        appendToTerminalOutput(data.data);
    });

    // Listen for installation started
    otaUpdateSocket.on('installation_started', function () {
        isConfiguring = true;
        showCurrentStep();
    });

    // Listen for installation completion
    otaUpdateSocket.on('installation_complete', function () {
        handleCompletion('success');
    });

    // Listen for installation failure
    otaUpdateSocket.on('installation_failed', function (data) {
        handleCompletion('failure');
    });

    // Listen for rollback events
    otaUpdateSocket.on('rollback_started', function () {
        appendToTerminalOutput('Rollback process started.');
        isConfiguring = true;  // Treat rollback as an ongoing process
        showCurrentStep();
    });

    otaUpdateSocket.on('rollback_complete', function () {
        appendToTerminalOutput('Rollback completed successfully.');
        handleCompletion('failure'); // Treat rollback completion as installation failure
    });

    otaUpdateSocket.on('rollback_failed', function (data) {
        appendToTerminalOutput(`Rollback failed: ${data.error}`);
        handleCompletion('failure');
    });
});
