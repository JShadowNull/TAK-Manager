document.addEventListener('DOMContentLoaded', function () {
    //===========================================
    // Variable Declarations & Initialization
    //===========================================
    // Popup related DOM elements
    const configureDataPackageBtn = document.getElementById('configure-data-package-btn');
    const popupId = 'popup-configure-data-package';
    const popupModal = document.getElementById(popupId);
    const popupCloseBtn = document.getElementById(`${popupId}-close-btn`);
    const popupNextBtn = document.getElementById(`${popupId}-next-btn`);
    const popupStopBtn = document.getElementById(`${popupId}-stop-btn`);
    const popupTerminalOutput = document.getElementById(`${popupId}-terminal-output`);

    // State tracking variables
    let isConfiguring = false;  // Track if configuration is in progress
    let currentStep = 1;        // Track the current step
    let stopButtonClicked = false; // Track if the stop button has been clicked
    let configurationId = null; // Store the configuration ID

    // Step elements
    const step1 = document.getElementById('data-package-step-1');
    const step2 = document.getElementById('data-package-step-2');

    //===========================================
    // Utility Functions
    //===========================================
    // Adds text to terminal output with auto-scroll
    function appendToTerminalOutput(text) {
        const newLine = document.createElement('div');
        newLine.textContent = text;
        newLine.classList.add('select-text');  // Allow text selection
        popupTerminalOutput.appendChild(newLine);
        popupTerminalOutput.scrollTop = popupTerminalOutput.scrollHeight; // Auto-scroll
    }

    // Handles popup closure and state reset
    function closePopup() {
        popupModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        isConfiguring = false;
        window.location.reload();
    }

    // Controls visibility of steps and buttons based on current state
    function showCurrentStep() {
        hideAllSteps();
        hideAllButtons();
        
        if (currentStep === 1 && step1) {
            step1.classList.remove('hidden');
            if (isConfiguring && !stopButtonClicked) {
                if (popupStopBtn) popupStopBtn.classList.remove('hidden');
            }
            if (popupCloseBtn) popupCloseBtn.classList.remove('hidden');
        } else if (currentStep === 2 && step2) {
            step2.classList.remove('hidden');
            if (popupCloseBtn) popupCloseBtn.classList.remove('hidden');
        }
    }

    // Utility function to hide all buttons
    function hideAllButtons() {
        if (popupNextBtn) popupNextBtn.classList.add('hidden');
        if (popupStopBtn) popupStopBtn.classList.add('hidden');
        if (popupCloseBtn) popupCloseBtn.classList.add('hidden');
    }

    // Utility function to hide all steps
    function hideAllSteps() {
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.add('hidden');
    }

    //===========================================
    // Event Listeners
    //===========================================
    // Configure button click handler
    if (configureDataPackageBtn) {
        configureDataPackageBtn.addEventListener('click', function() {
            if (popupModal) {
                popupModal.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
                currentStep = 1;
                showCurrentStep();
                startInstallation();
            }
        });
    }

    // Close button click handler
    if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', closePopup);
    }

    // Next button click handler
    if (popupNextBtn) {
        popupNextBtn.addEventListener('click', function () {
            if (currentStep === 1) {
                currentStep = 2;
                showCurrentStep();
            }
        });
    }

    // Stop button click handler
    if (popupStopBtn) {
        popupStopBtn.addEventListener('click', function () {
            if (isConfiguring && configurationId) {
                stopButtonClicked = true;
                popupStopBtn.classList.add('hidden');
                popupStopBtn.disabled = true;

                appendToTerminalOutput('Stopping configuration...');
                fetch('/stop-data-package', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ configuration_id: configurationId })
                })
                .then(response => response.json())
                .then(data => {
                    appendToTerminalOutput(data.message || data.error);
                })
                .catch(error => {
                    appendToTerminalOutput(`Error during stop: ${error}`);
                    handleCompletion('failure');
                });
            }
        });
    }

    //===========================================
    // Installation and Configuration Functions
    //===========================================
    // Initiates the installation process
    function startInstallation() {
        const preferencesData = gatherPreferencesData();

        if (Object.keys(preferencesData).length === 0) {
            preferencesData.default_setting = 'true';
        }

        fetch('/submit-preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(preferencesData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            appendToTerminalOutput(data.message || data.error);
            if (data.configuration_id) {
                isConfiguring = true;
                configurationId = data.configuration_id;
                showCurrentStep();
            } else {
                throw new Error('No configuration ID received');
            }
        })
        .catch(error => {
            appendToTerminalOutput(`Error during submission: ${error.message}`);
            handleCompletion('failure');
        });
    }

    // Collects form data for preferences
    function gatherPreferencesData() {
        const preferences = {};
        
        console.log('Starting to gather preferences...');
        
        // Add zip file name at the top
        const zipFileName = document.getElementById('zip-file-name');
        if (zipFileName && zipFileName.value) {
            preferences['#zip_file_name'] = zipFileName.value;
            console.log('Added zip file name:', preferences['#zip_file_name']);
        }
        
        const preferenceItems = document.querySelectorAll('.preference-item');
        let foundCaCert = false;
        let foundClientCert = false;

        preferenceItems.forEach(item => {
            // Check if the preference is enabled
            const enableCheckbox = item.querySelector('.enable-preference');
            if (!enableCheckbox || !enableCheckbox.checked) {
                console.log('Skipping disabled or missing checkbox item');
                return;
            }

            const labelElement = item.querySelector('[data-label]');
            if (!labelElement) {
                console.log('Skipping item without label element');
                return;
            }

            const label = labelElement.getAttribute('data-label') || labelElement.textContent.trim();
            if (!label) {
                console.log('Skipping item with empty label');
                return;
            }

            console.log(`Processing item with label: ${label}`);

            // Get all possible input elements, prioritizing cert-select
            const certSelect = item.querySelector('select.cert-select');
            const regularInput = item.querySelector('input[type="text"], input[type="password"], input[type="checkbox"]:not(.enable-preference), select:not(.cert-select)');
            
            // Handle certificate selects first
            if (certSelect) {
                console.log(`Found cert-select for ${label}:`, certSelect.value);
                
                // Only process certificate if a valid value is selected AND not the default 'cert/'
                if (certSelect.value && certSelect.value !== 'cert/' && certSelect.value !== '') {
                    // Extract just the filename from the path
                    const filename = certSelect.value.split('/').pop();
                    console.log(`Extracted filename: ${filename} from path: ${certSelect.value}`);
                    
                    if (label === 'caLocation0') {
                        foundCaCert = true;
                        preferences['#ca_cert_name'] = filename;
                        preferences[label] = filename;
                        console.log('Set CA cert:', {
                            marker: preferences['#ca_cert_name'],
                            preference: preferences[label]
                        });
                    } else if (label === 'certificateLocation0') {
                        foundClientCert = true;
                        preferences['#client_cert_name'] = filename;
                        preferences[label] = filename;
                        console.log('Set Client cert:', {
                            marker: preferences['#client_cert_name'],
                            preference: preferences[label]
                        });
                    }
                }
            }
            // Handle regular inputs
            else if (regularInput) {
                const value = regularInput.value;
                if (value !== undefined && value !== '') {
                    // Only handle certificate paths if they're valid
                    if (label === 'caLocation0' && value.startsWith('cert/') && value !== 'cert/') {
                        foundCaCert = true;
                        const filename = value.split('/').pop();
                        preferences['#ca_cert_name'] = filename;
                        preferences[label] = filename;
                    } else if (label === 'certificateLocation0' && value.startsWith('cert/') && value !== 'cert/') {
                        foundClientCert = true;
                        const filename = value.split('/').pop();
                        preferences['#client_cert_name'] = filename;
                        preferences[label] = filename;
                    } else if (regularInput.type === 'checkbox') {
                        preferences[label] = regularInput.checked;
                    } else {
                        preferences[label] = value;
                    }
                }
            }
        });

        // Remove certificate markers and related preferences if not found or invalid
        if (!foundCaCert) {
            delete preferences['#ca_cert_name'];
            delete preferences['caLocation0'];
            console.log('Removed CA cert preferences - not found or invalid');
        }
        if (!foundClientCert) {
            delete preferences['#client_cert_name'];
            delete preferences['certificateLocation0'];
            console.log('Removed Client cert preferences - not found or invalid');
        }

        console.log('Final preferences object:', preferences);
        return preferences;
    }

    // Handles completion status of installation
    function handleCompletion(status) {
        isConfiguring = false;
        popupStopBtn.classList.add('hidden');

        if (status === 'success') {
            appendToTerminalOutput('Configuration completed successfully.');
            popupNextBtn.classList.remove('hidden');
            popupCloseBtn.classList.add('hidden');
        } else if (status === 'failure') {
            appendToTerminalOutput('Configuration failed.');
            popupNextBtn.classList.add('hidden');
            popupCloseBtn.classList.remove('hidden');
        }
    }

    //===========================================
    // WebSocket Configuration and Handlers
    //===========================================
    // Initialize WebSocket connection
    const dataPackageSocket = io('/data-package', { 
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // WebSocket event handlers
    dataPackageSocket.on('connect', () => {
        appendToTerminalOutput('Connected to server');
    });

    dataPackageSocket.on('connect_error', (error) => {
        appendToTerminalOutput('Connection error: ' + error.message);
    });

    dataPackageSocket.on('disconnect', () => {
        appendToTerminalOutput('Disconnected from server');
    });

    dataPackageSocket.on('terminal_output', function (data) {
        appendToTerminalOutput(data.data);
    });

    dataPackageSocket.on('installation_started', function () {
        isConfiguring = true;
        showCurrentStep();
    });

    dataPackageSocket.on('installation_complete', function () {
        handleCompletion('success');
    });

    dataPackageSocket.on('installation_failed', function (data) {
        handleCompletion('failure');
    });

    //===========================================
    // Backend Connection Check
    //===========================================
    fetch('/configure-data-package')
        .then(response => {
            if (!response.ok) {
                appendToTerminalOutput('Error: Backend not accessible');
            }
        })
        .catch(error => {
            appendToTerminalOutput('Error: Cannot connect to backend');
        });

    //===========================================
    // Certificate Management Functions
    //===========================================
    // Requests certificate files from server
    function populateCertificateDropdowns() {
        dataPackageSocket.emit('get_certificate_files');

        dataPackageSocket.on('certificate_files', function(data) {
            console.log('Received certificate files:', data);
            
            if (!data.files || !Array.isArray(data.files)) {
                console.error('Invalid certificate files data:', data);
                return;
            }

            // Only target dropdowns with the class 'dropdown' and the certificate attribute
            document.querySelectorAll('.dropdown[data-certificate-dropdown="true"]').forEach(select => {
                // Store current value
                const currentValue = select.value;
                
                // Clear existing options except the first one
                while (select.options.length > 1) {
                    select.remove(1);
                }
                
                // Add certificates as options
                data.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = `cert/${file}`;
                    option.textContent = file;
                    select.appendChild(option);
                });

                // Restore previous value if it exists in new options
                if (currentValue) {
                    const exists = Array.from(select.options).some(opt => opt.value === currentValue);
                    if (exists) select.value = currentValue;
                }

                // Update hidden input
                const hiddenInput = select.nextElementSibling;
                if (hiddenInput && hiddenInput.type === 'hidden') {
                    hiddenInput.value = select.value;
                }
            });

            validateForm();
        });
    }

    // Handle dropdown changes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('cert-select')) {
            const hiddenInput = e.target.closest('.relative').querySelector('input[type="hidden"]');
            if (hiddenInput) {
                hiddenInput.value = e.target.value;
                savePreferences();
                validateForm();
            }
        }
    });

    //===========================================
    // Preference Management
    //===========================================
    async function initializePreferences() {
        let savedPreferences = {};
        
        try {
            // Try to load from backend first
            const response = await fetch('/load-preferences');
            const data = await response.json();
            if (data.preferences) {
                savedPreferences = data.preferences;
            }
        } catch (error) {
            console.error('Error loading preferences from backend:', error);
            // Fall back to localStorage if backend fails
            savedPreferences = JSON.parse(localStorage.getItem('preferenceSettings') || '{}');
        }

        const preferenceItems = document.querySelectorAll('.preference-item');
        
        preferenceItems.forEach(item => {
            const labelElement = item.querySelector('.text-xs, .preference-label');
            if (!labelElement) {
                console.warn('Preference item missing label element:', item);
                return;
            }
            
            const label = labelElement.textContent;
            const enableCheckbox = item.querySelector('.enable-preference');
            const inputElement = item.querySelector('input[type="text"], input[type="password"], input[type="checkbox"]:not(.enable-preference), select');
            
            if (label && enableCheckbox) {
                if (savedPreferences[label]) {
                    enableCheckbox.checked = savedPreferences[label].enabled;
                    if (inputElement && savedPreferences[label].value !== undefined) {
                        if (inputElement.type === 'checkbox') {
                            inputElement.checked = savedPreferences[label].value;
                        } else {
                            inputElement.value = savedPreferences[label].value;
                        }
                    }
                }

                updatePreferenceState(item, enableCheckbox.checked);
                
                enableCheckbox.addEventListener('change', (e) => {
                    updatePreferenceState(item, e.target.checked);
                    savePreferences();
                    validateForm();
                });

                if (inputElement) {
                    inputElement.addEventListener('change', () => {
                        savePreferences();
                        validateForm();
                    });
                }
            }
        });

        validateForm();
    }

    function updatePreferenceState(item, enabled) {
        const inputArea = item.querySelector('.input-area');
        if (!inputArea) return;

        const inputs = inputArea.querySelectorAll('input:not(.enable-preference), select');
        
        if (enabled) {
            inputArea.classList.remove('opacity-50', 'pointer-events-none');
            inputs.forEach(input => input.disabled = false);
        } else {
            inputArea.classList.add('opacity-50', 'pointer-events-none');
            inputs.forEach(input => input.disabled = true);
        }
    }

    function savePreferences() {
        const preferences = {};
        const preferenceItems = document.querySelectorAll('.preference-item');
        
        preferenceItems.forEach(item => {
            // Get label text more safely
            const labelElement = item.querySelector('.text-xs, .preference-label'); // Add alternative class
            if (!labelElement) {
                console.warn('Preference item missing label element:', item);
                return; // Skip this item
            }
            
            const label = labelElement.textContent;
            const enableCheckbox = item.querySelector('.enable-preference');
            const inputElement = item.querySelector('input[type="text"], input[type="password"], input[type="checkbox"]:not(.enable-preference), select');
            
            if (label && enableCheckbox) { // Only save if we have required elements
                preferences[label] = {
                    enabled: enableCheckbox.checked,
                    value: inputElement ? 
                        (inputElement.type === 'checkbox' ? inputElement.checked : inputElement.value) 
                        : null
                };
            }
        });

        // Save to localStorage as backup
        localStorage.setItem('preferenceSettings', JSON.stringify(preferences));
        
        // Save to backend
        fetch('/save-preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(preferences)
        }).catch(error => console.error('Error saving preferences:', error));
    }

    function validateForm() {
        const configureBtn = document.getElementById('configure-data-package-btn');
        const preferenceItems = document.querySelectorAll('.preference-item');
        const zipFileNameInput = document.getElementById('zip-file-name');
        let isValid = true;
        let hasCaCert = false;
        let hasClientCert = false;

        // Check if zip file name is provided
        if (!zipFileNameInput || !zipFileNameInput.value.trim()) {
            isValid = false;
        }

        // Check preferences including certificates
        preferenceItems.forEach(item => {
            const enableCheckbox = item.querySelector('.enable-preference');
            if (!enableCheckbox || !enableCheckbox.checked) return;

            const labelElement = item.querySelector('.text-sm.preference-label') || 
                               item.querySelector('.text-xs.preference-label');
            if (!labelElement) return;

            const label = item.querySelector('input[name]')?.name || 
                         labelElement.getAttribute('data-label') || 
                         labelElement.textContent.trim();

            const select = item.querySelector('.cert-select');
            const inputElement = item.querySelector('input[type="text"], input[type="password"], input[type="checkbox"]:not(.enable-preference)');
            
            if (select) {
                if (!select.value) isValid = false;
                if (label === 'caLocation0') hasCaCert = Boolean(select.value);
                if (label === 'certificateLocation0') hasClientCert = Boolean(select.value);
            } else if (inputElement && inputElement.type !== 'checkbox') {
                if (!inputElement.value.trim()) isValid = false;
            }
        });

        // Ensure both certificates are selected if either is enabled
        if ((hasCaCert || hasClientCert) && !(hasCaCert && hasClientCert)) {
            isValid = false;
            console.warn('Both CA and Client certificates must be selected');
        }

        if (configureBtn) {
            configureBtn.disabled = !isValid;
            configureBtn.classList.toggle('opacity-50', !isValid);
            configureBtn.classList.toggle('cursor-not-allowed', !isValid);
        }
    }

    //===========================================
    // Select/Unselect All Functionality
    //===========================================
    function setupSelectAllButtons() {
        // Handle Select All buttons
        document.querySelectorAll('.select-all-btn').forEach(button => {
            button.addEventListener('click', () => {
                const section = button.dataset.section;
                const container = section === 'cot-streams' ? 
                    document.querySelector('.cot-streams-container') : 
                    document.querySelector('.app-prefs-container');
                
                if (!container) return;
                
                const preferenceItems = container.querySelectorAll('.preference-item');
                preferenceItems.forEach(item => {
                    const enableCheckbox = item.querySelector('.enable-preference');
                    if (enableCheckbox && !enableCheckbox.checked) {
                        enableCheckbox.checked = true;
                        updatePreferenceState(item, true);
                    }
                });
                
                savePreferences();
                validateForm();
            });
        });

        // Handle Unselect All buttons
        document.querySelectorAll('.unselect-all-btn').forEach(button => {
            button.addEventListener('click', () => {
                const section = button.dataset.section;
                const container = section === 'cot-streams' ? 
                    document.querySelector('.cot-streams-container') : 
                    document.querySelector('.app-prefs-container');
                
                if (!container) return;
                
                const preferenceItems = container.querySelectorAll('.preference-item');
                preferenceItems.forEach(item => {
                    const enableCheckbox = item.querySelector('.enable-preference');
                    if (enableCheckbox && enableCheckbox.checked) {
                        enableCheckbox.checked = false;
                        updatePreferenceState(item, false);
                    }
                });
                
                savePreferences();
                validateForm();
            });
        });
    }

    //===========================================
    // Search Functionality
    //===========================================
    function setupSearchFunctionality() {
        const searchInput = document.getElementById('app-prefs-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const container = document.querySelector('.app-prefs-container');
            const preferenceItems = container.querySelectorAll('.preference-item');

            preferenceItems.forEach(item => {
                const labelElement = item.querySelector('.preference-label');
                if (!labelElement) return;

                const text = labelElement.textContent.toLowerCase();
                const match = text.includes(searchTerm);

                // Handle highlighting and visibility
                if (searchTerm === '') {
                    item.style.display = '';
                    labelElement.innerHTML = text; // Reset highlighting
                } else {
                    if (match) {
                        item.style.display = '';
                        // Highlight matching text
                        const regex = new RegExp(`(${searchTerm})`, 'gi');
                        labelElement.innerHTML = text.replace(regex, '<mark class="bg-selectedColor text-black">$1</mark>');
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });

        // Add keyboard shortcut (Cmd/Ctrl + F)
        document.addEventListener('keydown', function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault(); // Prevent default browser search
                searchInput.focus();
            }
        });

        // Add Escape key handler to clear search
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                searchInput.blur();
            }
        });
    }

    // Initialize everything
    populateCertificateDropdowns();
    initializePreferences();
    setupSelectAllButtons();
    setupSearchFunctionality();

    // Add event listener for zip file name input
    const zipFileNameInput = document.getElementById('zip-file-name');
    if (zipFileNameInput) {
        zipFileNameInput.addEventListener('input', validateForm);
    }
});
