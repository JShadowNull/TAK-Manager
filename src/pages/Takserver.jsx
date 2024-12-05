import React from 'react';
import { TakServerStatus, AdvancedFeatures, Configuration } from '../components/takserver';

function Takserver() {
  const handleStartStop = async (isRunning) => {
    const action = isRunning ? 'stop' : 'start';
    try {
      const response = await fetch(`/api/takserver/takserver-${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} TAK Server`);
      }

      const data = await response.json();
      console.log(data.message);
    } catch (error) {
      console.error(`${action} error:`, error);
    }
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      <TakServerStatus handleStartStop={handleStartStop} />
    </div>
  );
}

export default Takserver;
