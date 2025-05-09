import React, { useState } from 'react';
import StatusDisplay from './components/TakServerStatus/StatusDisplay';
import ControlButtons from './components/TakServerStatus/ControlButtons';
import InstallationForm from './components/TakServerStatus/InstallationForm';

interface TakServerStatusProps {
  serverState: {
    isInstalled: boolean;
    isRunning: boolean;
    version: string;
    error?: string;
  };
  loading?: boolean;
}

const TakServerStatus: React.FC<TakServerStatusProps> = ({ serverState }) => {
  // UI state
  const [showInstallForm, setShowInstallForm] = useState(false);

  return (
    <>
      <div className="w-full border border-border bg-card p-4 lg:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col h-full justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 text-primary">TAK Server Status</h3>
            <StatusDisplay takState={serverState} />
          </div>
          <ControlButtons
            takState={serverState}
            onInstall={() => setShowInstallForm(true)}
          />
        </div>
      </div>

      {showInstallForm && (
        <InstallationForm onCancel={() => setShowInstallForm(false)} />
      )}
    </>
  );
};

export default TakServerStatus; 