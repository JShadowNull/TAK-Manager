import React from 'react';
import { TakServerStatus, AdvancedFeatures, Configuration } from '../components/takserver';

function Takserver() {
  return (
    <div className="flex flex-col gap-6">
      <TakServerStatus />
    </div>
  );
}

export default Takserver;
