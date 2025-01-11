import React, { useState, useEffect } from 'react';
import TakServerStatus from '../components/takserver/TakServerStatus';
import Configuration from '../components/takserver/Configuration';
import AdvancedFeatures from '../components/takserver/AdvancedFeatures';

interface ServerState {
  isInstalled: boolean;
  isRunning: boolean;
  status: string;
  error: string | null;
  version: string;
}

const defaultState: ServerState = {
  isInstalled: false,
  isRunning: false,
  status: 'idle',
  error: null,
  version: 'Not Installed'
};

export const Takserver: React.FC = () => {
  const [serverState, setServerState] = useState<ServerState>(() => {
    const savedState = localStorage.getItem('takServerState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        return {
          ...defaultState,
          ...parsedState,
          isInstalled: parsedState.isInstalled === true
        };
      } catch (error) {
        console.error('Error parsing saved state:', error);
        return defaultState;
      }
    }
    return defaultState;
  });

  // Listen for changes to localStorage and custom events
  useEffect(() => {
    const handleStateChange = () => {
      const savedState = localStorage.getItem('takServerState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setServerState(state => ({
            ...state,
            ...parsedState,
            isInstalled: parsedState.isInstalled === true
          }));
        } catch (error) {
          console.error('Error parsing saved state:', error);
        }
      }
    };

    window.addEventListener('storage', handleStateChange);
    window.addEventListener('takServerStateChange', handleStateChange);
    return () => {
      window.removeEventListener('storage', handleStateChange);
      window.removeEventListener('takServerStateChange', handleStateChange);
    };
  }, []);

  return (
    <div className="space-y-4">
      <TakServerStatus initialState={serverState} />
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
