// frontend/static/js/docker_manager.js

document.addEventListener('DOMContentLoaded', function () {
    const dockerSwitch = document.getElementById('docker-switch');
    const dockerStatus = document.getElementById('docker-status');
    const containerList = document.getElementById('container-list');

    // Connect to the Docker Manager namespace via Socket.IO
    const dockerManagerSocket = io('/docker-manager', { transports: ['websocket'] });

    // Object to track pending container actions
    const pendingContainerActions = {};

    // Listen for Docker status updates from the server
    dockerManagerSocket.on('docker_status', function (data) {
        updateDockerStatus(data.docker_running);
    });

    // Listen for container list updates from the server
    dockerManagerSocket.on('containers', function (data) {
        updateContainerList(data.containers);
    });

    // Listen for container status updates from the server
    dockerManagerSocket.on('container_status_update', function (data) {
        updateContainerStatus(data.container_name, data.status);
    });

    // Event listener for Docker switch (starting/stopping Docker)
    dockerSwitch.addEventListener('change', function () {
        dockerSwitch.disabled = true; // Disable switch while Docker is being started/stopped
        if (dockerSwitch.checked) {
            dockerStatus.textContent = 'Starting Docker...';
            dockerManagerSocket.emit('start_docker'); // Emit event to start Docker
        } else {
            dockerStatus.textContent = 'Stopping Docker...';
            dockerManagerSocket.emit('stop_docker'); // Emit event to stop Docker
        }
    });

    // Function to update Docker status in the UI
    function updateDockerStatus(isRunning) {
        dockerSwitch.checked = isRunning;
        dockerSwitch.disabled = false; // Re-enable the switch after Docker starts/stops
        dockerStatus.textContent = isRunning ? 'Docker is running' : 'Docker is stopped';

        // If Docker is running, request the container list
        if (isRunning) {
            dockerManagerSocket.emit('list_containers');
        } else {
            containerList.innerHTML = '<li class="border-1 border-accentBoarder p-4 rounded">Start Docker to view containers</li>';
        }
    }

    // Function to update the container list in the UI
    function updateContainerList(containers) {
        containerList.innerHTML = ''; // Clear existing list
        if (!containers || containers.length === 0) {
            containerList.innerHTML = '<li class="border-1 border-accentBoarder p-4 rounded">No containers found</li>';
        } else {
            containers.forEach(container => {
                const li = document.createElement('li');
                li.classList.add('p-4', 'rounded', 'flex', 'justify-between', 'items-center', 'space-x-4', 'border-1', 'border-accentBoarder');

                const containerText = document.createElement('span');
                containerText.classList.add('flex-grow');
                containerText.textContent = `Container: ${container.name} (Status: ${container.status})`;

                const button = createContainerButton(container.name, container.status);

                li.appendChild(containerText);
                li.appendChild(button);
                containerList.appendChild(li);
            });
        }
    }

    // Function to create a container control button
    function createContainerButton(containerName, status) {
        const button = document.createElement('button');
        button.classList.add('focus:outline-none', 'text-lg');
        updateButtonState(button, containerName, status);
        return button;
    }

    // Function to update button state
    function updateButtonState(button, containerName, status) {
        // Clear the pending action if the status has changed
        if (pendingContainerActions[containerName]) {
            if ((status.toLowerCase().includes('up') || status.toLowerCase().includes('running')) && 
                pendingContainerActions[containerName] === 'start') {
                delete pendingContainerActions[containerName];
            } else if ((!status.toLowerCase().includes('up') && !status.toLowerCase().includes('running')) && 
                       pendingContainerActions[containerName] === 'stop') {
                delete pendingContainerActions[containerName];
            }
        }

        if (pendingContainerActions[containerName]) {
            setButtonSpinnerState(button, true);
        } else {
            setButtonSpinnerState(button, false);
            if (status.toLowerCase().includes('up') || status.toLowerCase().includes('running')) {
                button.innerHTML = '<i class="fas fa-stop"></i>';
                button.classList.remove('text-gray-500', 'text-green-500', 'hover:text-green-600');
                button.classList.add('text-red-500', 'hover:text-red-600');
                button.onclick = () => toggleContainer(containerName, 'stop');
            } else {
                button.innerHTML = '<i class="fas fa-play"></i>';
                button.classList.remove('text-gray-500', 'text-red-500', 'hover:text-red-600');
                button.classList.add('text-green-500', 'hover:text-green-600');
                button.onclick = () => toggleContainer(containerName, 'start');
            }
        }
        button.disabled = !!pendingContainerActions[containerName];
    }

    // Function to set button spinner state
    function setButtonSpinnerState(button, isSpinning) {
        if (isSpinning) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.classList.remove('text-red-500', 'text-green-500', 'hover:text-red-600', 'hover:text-green-600');
            button.classList.add('text-gray-500');
        } else {
            button.disabled = false;
            button.classList.remove('text-gray-500');
        }
    }

    // Function to toggle a container's state
    function toggleContainer(containerName, action) {
        pendingContainerActions[containerName] = action;
        const button = event.target.closest('button');
        setButtonSpinnerState(button, true);

        dockerManagerSocket.emit(`${action}_container`, { container_name: containerName });
    }

    // Function to update a specific container's status
    function updateContainerStatus(containerName, status) {
        const containerItem = Array.from(containerList.children).find(li => li.textContent.includes(containerName));
        if (containerItem) {
            const containerText = containerItem.querySelector('span');
            const button = containerItem.querySelector('button');

            containerText.textContent = `Container: ${containerName} (Status: ${status})`;
            
            // Update the button state (which now handles clearing the pending action)
            updateButtonState(button, containerName, status);
        }
    }

    // Request Docker status on page load
    dockerManagerSocket.emit('check_docker_status');
});
