import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../shared/ui/Button';

function Configuration() {
  const navigate = useNavigate();

  return (
    <div className="w-full border border-border bg-card p-4 rounded-lg">
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold">Configuration</h3>
        <div className="flex gap-4">
          <Button
            variant="primary"
            onClick={() => navigate('/data-package')}
          >
            Generate Data Package
          </Button>
          <Button
            variant="primary" 
            onClick={() => console.log('make certs')}
          >
            Generate Certs
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Configuration;