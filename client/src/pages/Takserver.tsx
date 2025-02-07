import React from 'react';
import TakServerStatus from '../components/takserver/TakServerStatus';
import Configuration from '../components/takserver/Configuration';
import AdvancedFeatures from '../components/takserver/AdvancedFeatures';
import { useTakServer } from '../components/shared/ui/shadcn/sidebar/app-sidebar';

export const Takserver: React.FC = () => {
  const { serverState } = useTakServer();

  // Show nothing while we wait for initial state
  if (!serverState) {
    return null;
  }

  // Show only TakServerStatus when not installed
  if (!serverState.isInstalled) {
    return (
      <div className="space-y-4">
        <TakServerStatus serverState={serverState} />
      </div>
    );
  }

  // Show full UI when installed
  return (
    <div className="space-y-4">
      <TakServerStatus serverState={serverState} />
      <AdvancedFeatures />
      <Configuration />
    </div>
  );
};

export default Takserver;
