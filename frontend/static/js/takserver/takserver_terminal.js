document.addEventListener('DOMContentLoaded', function () {
    // Variables for the TAKServer installation popup
    const installTakserverBtn = document.getElementById('install-takserver-btn');
    const popupId = 'popup-install-takserver';
    const popupModal = document.getElementById(popupId);
    const popupCloseBtn = document.getElementById(`${popupId}-close-btn`);
    const popupBackBtn = document.getElementById(`${popupId}-back-btn`);
    const popupNextBtn = document.getElementById(`${popupId}-next-btn`);
    const popupStartInstallBtn = document.getElementById(`${popupId}-start-install-btn`);
    const popupStopBtn = document.getElementById(`${popupId}-stop-btn`);
    const popupTerminalOutput = document.getElementById(`${popupId}-terminal-output`);
    const popupInstallSuccessLaunchBtn = document.getElementById(`${popupId}-success-launch-btn`);
    let isInstalling = false;  // Track if installation is in progress
    let currentStep = 1;       // Track the current step
    let installationId = null; // Store the installation ID
    let stopButtonClicked = false; // Track if the stop button has been clicked

    // Step elements
    const step1 = document.getElementById('takserver-step-1');
    const step2 = document.getElementById('takserver-step-2');
    const step3 = document.getElementById('takserver-step-3');
    const step4 = document.getElementById('takserver-step-4');

    // Add new constant for Docker check step
    const stepDockerRequired = document.getElementById('takserver-step-docker-required');
    const takserverInstallDockerBtn = document.getElementById('takserver-install-docker-btn');

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
        isInstalling = false;
        window.location.reload();
    }

    // Show current step
    function showCurrentStep() {
        // Hide all steps first
        hideAllSteps();
        
        // Hide all buttons first
        hideAllButtons();
        
        if (currentStep === 'docker-required') {
            // Docker not installed state
            stepDockerRequired.classList.remove('hidden');
            takserverInstallDockerBtn.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
        } else if (currentStep === 1) {
            // First step - introduction
            step1.classList.remove('hidden');
            popupNextBtn.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
            // Don't show back button on first step
        } else if (currentStep === 2) {
            // Form step
            step2.classList.remove('hidden');
            popupBackBtn.classList.remove('hidden');
            popupStartInstallBtn.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
        } else if (currentStep === 3) {
            // Installation progress
            step3.classList.remove('hidden');
            if (isInstalling && !stopButtonClicked) {
                popupStopBtn.classList.remove('hidden');
            }
            popupCloseBtn.classList.add('hidden');
        } else if (currentStep === 4) {
            // Success step
            step4.classList.remove('hidden');
            popupCloseBtn.classList.remove('hidden');
            popupInstallSuccessLaunchBtn.classList.remove('hidden');
        }
    }

    // Event Listeners
    if (installTakserverBtn) {
        installTakserverBtn.addEventListener('click', function() {
            // Connect to TAKServer installer socket only when this button is clicked
            const takserverInstallerSocket = io('/takserver-installer', { transports: ['websocket'] });

            // Emit event to check if Docker is installed
            takserverInstallerSocket.emit('check_docker_installed');

            // Listen for docker_installed_status event
            takserverInstallerSocket.on('docker_installed_status', function(data) {
                if (data.installed) {
                    popupModal.classList.remove('hidden');
                    document.body.classList.add('overflow-hidden');
                    currentStep = 1; // Start with step 1 if Docker is installed
                } else {
                    popupModal.classList.remove('hidden');
                    document.body.classList.add('overflow-hidden');
                    currentStep = 'docker-required'; // Show Docker required step if Docker is not installed
                }
                showCurrentStep();
            });

            // Handle WebSocket connect and disconnect events
            takserverInstallerSocket.on('connect', function () {
                appendToTerminalOutput('Connected to the TAKServer installer.');
            });

            takserverInstallerSocket.on('disconnect', function () {
                appendToTerminalOutput('Disconnected from the TAKServer installer.');
            });
        });
    }
    popupCloseBtn.addEventListener('click', closePopup);

    // Logic for Back Button
    popupBackBtn.addEventListener('click', function () {
        if (currentStep === 2 || currentStep === 3) { // Only allow back button for steps 2 and 3
            currentStep--;
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
        } else if (currentStep === 3) {
            currentStep = 4; // Move from step 3 to step 4
            showCurrentStep();
        }
    });

    // Function to validate form inputs
    function validateFormInputs(formData) {
        // Bypass regex checks to allow all inputs
        return true;
    }

    // Logic for Begin Button
    popupStartInstallBtn.addEventListener('click', function () {
        console.log('Begin button clicked'); // Debugging log

        // Collect form data
        const form = document.getElementById('takserver-install-form');
        const formData = new FormData(form);

        // Check if form is valid
        if (!form.checkValidity() || !validateFormInputs(formData)) {
            console.log('Form is invalid'); // Debugging log
            form.reportValidity();
            popupStartInstallBtn.disabled = false; // Ensure button is re-enabled
            return;
        }

        console.log('Form is valid, proceeding with installation'); // Debugging log

        // Disable the start button during installation
        popupStartInstallBtn.disabled = true;

        // Move to step 3
        currentStep = 3;
        showCurrentStep();

        appendToTerminalOutput('Starting TAKServer installation...');
        isInstalling = true;  // Mark that the installation is in progress

        // Trigger TAKServer installation
        fetch('/install-takserver', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            console.log('Response data:', data); // Debugging log
            if (data.installation_id) {
                installationId = data.installation_id; // Store the installation ID
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

    // Add event listeners to re-enable the button when input changes
    document.querySelectorAll('#takserver-install-form input').forEach(input => {
        input.addEventListener('input', function() {
            popupStartInstallBtn.disabled = false; // Re-enable the button on input change
        });
    });

    // Logic for Stop Button
    popupStopBtn.addEventListener('click', function () {
        if (isInstalling && installationId) {
            // Hide the stop button immediately after it's clicked
            stopButtonClicked = true; // Mark that the stop button has been clicked
            popupStopBtn.classList.add('hidden');
            popupStopBtn.disabled = true; // Ensure the stop button is disabled

            // If installation is in progress, trigger rollback
            appendToTerminalOutput('Stopping installation and rolling back...');
            fetch('/rollback-takserver', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ installation_id: installationId })
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

    // Function to handle completion or failure
    function handleCompletion(status) {
        isInstalling = false;
        popupStopBtn.classList.add('hidden'); // Always hide the Stop button when installation is complete

        if (status === 'success') {
            appendToTerminalOutput('Installation completed successfully.');
            popupNextBtn.classList.remove('hidden'); // Show Next button on success
            popupCloseBtn.classList.add('hidden');   // Hide Close button on success
        } else if (status === 'failure') {
            appendToTerminalOutput('Installation failed.');
            popupNextBtn.classList.add('hidden');    // Hide Next button on failure
            popupCloseBtn.classList.remove('hidden'); // Show Close button on failure
        }
    }

    // WebSocket connection for real-time terminal output
    const takserverInstallerSocket = io('/takserver-installer', { transports: ['websocket'] });

    // Listen for terminal output
    takserverInstallerSocket.on('terminal_output', function (data) {
        appendToTerminalOutput(data.data);
    });

    // Listen for installation started
    takserverInstallerSocket.on('installation_started', function () {
        isInstalling = true;
        showCurrentStep();
    });

    // Listen for installation completion
    takserverInstallerSocket.on('installation_complete', function () {
        handleCompletion('success');
    });

    // Listen for installation failure
    takserverInstallerSocket.on('installation_failed', function (data) {
        handleCompletion('failure');
    });

    // Listen for rollback completion
    takserverInstallerSocket.on('rollback_complete', function () {
        appendToTerminalOutput('Rollback completed successfully.');
        handleCompletion('failure'); // Treat rollback completion as installation failure
    });

    // Listen for rollback failure
    takserverInstallerSocket.on('rollback_failed', function (data) {
        appendToTerminalOutput(`Rollback failed: ${data.error}`);
        handleCompletion('failure');
    });

    // Listen for rollback started
    takserverInstallerSocket.on('rollback_started', function () {
        isInstalling = true;  // Treat rollback as an ongoing process
        popupStopBtn.classList.add('hidden'); // Ensure Stop button doesn't reappear
        popupStopBtn.disabled = true; // Disable the Stop button just in case it pops up
        showCurrentStep();
    });

    // Handle WebSocket connect and disconnect events
    takserverInstallerSocket.on('connect', function () {
        appendToTerminalOutput('Connected to the server.');
    });

    takserverInstallerSocket.on('disconnect', function () {
        appendToTerminalOutput('Disconnected from the server.');
    });

    // Event listener for the Launch button
    document.getElementById('popup-install-takserver-success-launch-btn').addEventListener('click', function() {
        const url = 'https://127.0.0.1:8443/';
        // Launch the URL using the exposed Python function
        if (window.pywebview) {
            window.pywebview.api.open_url(url);
        } else {
            console.error('pywebview API not found');
        }
    });

    // Ensure the button IDs match those in the HTML
    // Check if the elements are correctly selected
    if (!installTakserverBtn || !popupModal || !popupCloseBtn || !popupBackBtn || !popupNextBtn || !popupStartInstallBtn || !popupStopBtn || !popupTerminalOutput) {
        console.error('One or more elements could not be found. Please check the IDs in the HTML.');
    }

    // Function to hide all steps
    function hideAllSteps() {
        stepDockerRequired.classList.add('hidden');
        step1.classList.add('hidden');
        step2.classList.add('hidden');
        step3.classList.add('hidden');
        step4.classList.add('hidden');
    }

    // Function to hide all buttons
    function hideAllButtons() {
        takserverInstallDockerBtn.classList.add('hidden');
        popupBackBtn.classList.add('hidden');
        popupNextBtn.classList.add('hidden');
        popupStartInstallBtn.classList.add('hidden');
        popupStopBtn.classList.add('hidden');
        popupCloseBtn.classList.add('hidden');
        popupInstallSuccessLaunchBtn.classList.add('hidden');
    }

    // Add event listener for Install Docker button
    if (takserverInstallDockerBtn) {
        takserverInstallDockerBtn.addEventListener('click', function() {
            // Hide the TAKServer popup and show the Docker installation process
            popupModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            
            const dockerBtn = document.getElementById('install-docker-btn');
            if (dockerBtn) {
                const event = new CustomEvent('openDockerInstaller');
                document.dispatchEvent(event);
            } else {
                console.error('Docker install button not found');
            }
        });
    }
});