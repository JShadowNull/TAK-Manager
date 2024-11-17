document.addEventListener('DOMContentLoaded', function () {
    // Ensure all DOM elements are correctly selected
    const installDockerBtn = document.getElementById('install-docker-btn');
    const popupId = 'popup-install-docker';
    const popupModal = document.getElementById(popupId);
    const popupCloseBtn = document.getElementById(`${popupId}-close-btn`);
    const popupDockerDownloadLink = document.getElementById(`${popupId}-download-link`);
    const dockerInstallTakserverBtn = document.getElementById(`${popupId}-install-takserver-btn`);
    let currentStep = 'download';

    // Step elements
    const stepDownload = document.getElementById('docker-step-download');
    const stepAlreadyInstalled = document.getElementById('docker-step-already-installed');

    // Connect to Socket.IO server with namespace
    const socket = io('/docker-installer');

    function closePopup() {
        if (popupModal) popupModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        currentStep = 'download';
        showCurrentStep();
    }

    function hideAllSteps() {
        if (stepDownload) stepDownload.classList.add('hidden');
        if (stepAlreadyInstalled) stepAlreadyInstalled.classList.add('hidden');
    }

    function hideAllButtons() {
        if (popupCloseBtn) popupCloseBtn.classList.add('hidden');
        if (popupDockerDownloadLink) popupDockerDownloadLink.classList.add('hidden');
        if (dockerInstallTakserverBtn) dockerInstallTakserverBtn.classList.add('hidden');
    }

    function showCurrentStep() {
        hideAllSteps();
        hideAllButtons();
        
        if (currentStep === 'download' && stepDownload) {
            stepDownload.classList.remove('hidden');
            if (popupCloseBtn) popupCloseBtn.classList.remove('hidden');
            if (popupDockerDownloadLink) popupDockerDownloadLink.classList.remove('hidden');
        } else if (currentStep === 'already-installed' && stepAlreadyInstalled) {
            stepAlreadyInstalled.classList.remove('hidden');
            if (popupCloseBtn) popupCloseBtn.classList.remove('hidden');
            if (dockerInstallTakserverBtn) dockerInstallTakserverBtn.classList.remove('hidden');
        }
    }

    function openTakserverPopup() {
        closePopup();
        
        const takserverScript = document.querySelector('script[src*="takserver_terminal.js"]');
        if (takserverScript) {
            const takserverModal = document.getElementById('popup-install-takserver');
            if (takserverModal) {
                takserverModal.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
                
                const takserverBtn = document.getElementById('install-takserver-btn');
                if (takserverBtn) {
                    takserverBtn.dispatchEvent(new Event('click'));
                } else {
                    console.error('TAKServer install button not found');
                }
            } else {
                console.error('TAKServer modal not found');
            }
        } else {
            console.error('TAKServer script not found');
        }
    }

    // Event listeners
    if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', closePopup);
    }

    if (installDockerBtn) {
        installDockerBtn.addEventListener('click', function() {
            installDockerBtn.classList.add('opacity-50', 'cursor-wait');
            
            // Emit event to check if Docker is installed
            socket.emit('check_docker_installed');
        });
    }

    if (popupDockerDownloadLink) {
        popupDockerDownloadLink.addEventListener('click', function() {
            const url = 'https://www.docker.com/products/docker-desktop';
            // Launch the URL using the exposed Python function
            if (window.pywebview) {
                window.pywebview.api.open_url(url);
            } else {
                window.open(url, '_blank');
            }
        });
    }

    if (dockerInstallTakserverBtn) {
        dockerInstallTakserverBtn.addEventListener('click', openTakserverPopup);
    }

    document.addEventListener('openDockerInstaller', function() {
        if (installDockerBtn) installDockerBtn.classList.add('opacity-50', 'cursor-wait');
        
        // Emit event to check if Docker is installed
        socket.emit('check_docker_installed');
    });

    // Listen for the docker_installed_status event
    socket.on('docker_installed_status', function(data) {
        if (data.installed) {
            if (popupModal) popupModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
            currentStep = 'already-installed';
        } else {
            if (popupModal) popupModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
            currentStep = 'download';
        }
        showCurrentStep();
        if (installDockerBtn) installDockerBtn.classList.remove('opacity-50', 'cursor-wait');
    });

    if (!installDockerBtn || !popupModal || !popupCloseBtn || !popupDockerDownloadLink || !dockerInstallTakserverBtn) {
        console.error('One or more elements could not be found. Please check the IDs in the HTML.');
    }
});
