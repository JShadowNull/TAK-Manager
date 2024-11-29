import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

function Services() {
  const [dockerStatus, setDockerStatus] = useState('Checking Docker status...');
  const [isDockerRunning, setIsDockerRunning] = useState(false);
  const [containers, setContainers] = useState([]);
  const [pendingContainerActions, setPendingContainerActions] = useState({});
  const [dockerSocket, setDockerSocket] = useState(null);

  useEffect(() => {
    // Connect to the Docker Manager namespace via Socket.IO
    const socket = io('/docker-manager', { transports: ['websocket'] });
    setDockerSocket(socket);

    // Socket event listeners
    socket.on('docker_status', (data) => {
      setIsDockerRunning(data.docker_running);
      setDockerStatus(data.docker_running ? 'Docker is running' : 'Docker is stopped');
      if (data.docker_running) {
        socket.emit('list_containers');
      }
    });

    socket.on('containers', (data) => {
      setContainers(data.containers || []);
    });

    socket.on('container_status_update', (data) => {
      setContainers(prevContainers => 
        prevContainers.map(container => 
          container.name === data.container_name 
            ? { ...container, status: data.status }
            : container
        )
      );
      // Clear pending action if status matches the requested action
      setPendingContainerActions(prev => {
        const newPending = { ...prev };
        if (newPending[data.container_name]) {
          delete newPending[data.container_name];
        }
        return newPending;
      });
    });

    // Request initial Docker status
    socket.emit('check_docker_status');

    return () => socket.disconnect();
  }, []);

  const handleDockerToggle = (e) => {
    const isChecked = e.target.checked;
    setDockerStatus(isChecked ? 'Starting Docker...' : 'Stopping Docker...');
    dockerSocket.emit(isChecked ? 'start_docker' : 'stop_docker');
  };

  const toggleContainer = (containerName, action) => {
    setPendingContainerActions(prev => ({
      ...prev,
      [containerName]: action
    }));
    dockerSocket.emit(`${action}_container`, { container_name: containerName });
  };

  return (
    <div className="flex gap-8 pt-14">
      <div className="flex flex-col gap-8 w-1/3">
        {/* Start/Stop Services */}
        <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white w-full border-1 border-accentBoarder">
          <h2 className="text-base mb-4 text-center">Start/Stop Services</h2>
          <label htmlFor="docker-switch" className="flex items-center cursor-pointer relative">
            <input
              type="checkbox"
              id="docker-switch"
              className="sr-only"
              checked={isDockerRunning}
              onChange={handleDockerToggle}
              disabled={dockerStatus.includes('Starting') || dockerStatus.includes('Stopping')}
            />
            <div className="w-10 h-4 bg-gray-400 rounded-full shadow-inner"></div>
            <div className={`dot absolute w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ease-in-out ${isDockerRunning ? 'translate-x-5' : 'translate-x-0'}`}></div>
            <span className="ml-3 text-white text-sm">{dockerStatus}</span>
          </label>
        </div>
      </div>

      {/* Docker Containers */}
      <div className="w-2/3 bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
        <h2 className="text-base mb-4 text-center">Docker Containers</h2>
        <ul className="list-none space-y-2 text-sm">
          {!isDockerRunning ? (
            <li className="border-1 border-accentBoarder p-4 rounded">Start Docker to view containers</li>
          ) : containers.length === 0 ? (
            <li className="border-1 border-accentBoarder p-4 rounded">No containers found</li>
          ) : (
            containers.map(container => (
              <li key={container.name} className="p-4 rounded flex justify-between items-center space-x-4 border-1 border-accentBoarder">
                <span className="flex-grow">
                  Container: {container.name} (Status: {container.status})
                </span>
                <button
                  className={`focus:outline-none text-lg ${
                    pendingContainerActions[container.name]
                      ? 'text-gray-500'
                      : container.status.toLowerCase().includes('up') || container.status.toLowerCase().includes('running')
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-green-500 hover:text-green-600'
                  }`}
                  disabled={!!pendingContainerActions[container.name]}
                  onClick={() => {
                    const action = container.status.toLowerCase().includes('up') || 
                                 container.status.toLowerCase().includes('running') ? 'stop' : 'start';
                    toggleContainer(container.name, action);
                  }}
                >
                  {pendingContainerActions[container.name] ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : container.status.toLowerCase().includes('up') || 
                       container.status.toLowerCase().includes('running') ? (
                    <i className="fas fa-stop" />
                  ) : (
                    <i className="fas fa-play" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export default Services; 