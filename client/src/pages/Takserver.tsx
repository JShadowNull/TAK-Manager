import React, { useState, useEffect } from 'react';
import TakServerStatus from '../components/takserver/TakServerStatus';
import Configuration from '../components/takserver/Configuration';
import AdvancedFeatures from '../components/takserver/AdvancedFeatures';

interface ServerState {
  isInstalled: boolean;
  isRunning: boolean;
  version: string;
  error?: string;
}

export const Takserver: React.FC = () => {
  const [serverState, setServerState] = useState<ServerState>({
    isInstalled: false,
    isRunning: false,
    version: 'Not Installed'
  });

  // Server status stream
  useEffect(() => {
    const serverStatus = new EventSource('/api/takserver/server-status-stream');
    serverStatus.addEventListener('server-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        setServerState({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          version: data.version,
          error: data.error
        });

        // Save to localStorage for sidebar state
        localStorage.setItem('takServerState', JSON.stringify({
          isInstalled: data.isInstalled,
          isRunning: data.isRunning,
          version: data.version
        }));

        // Dispatch event for sidebar to detect change
        window.dispatchEvent(new Event('takServerStateChange'));
      } catch (error) {
        console.error('Error parsing server status:', error);
      }
    });

    return () => serverStatus.close();
  }, []);

  return (
    <div className="space-y-4">
      <TakServerStatus serverState={serverState} />
      {serverState.isInstalled && (
        <>
          <AdvancedFeatures />
          <Configuration />
        </>
      )}
    </div>
  );
};

export default Takserver;
