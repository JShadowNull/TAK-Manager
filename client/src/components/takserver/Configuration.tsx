import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/shadcn/button';

const Configuration: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full border border-border bg-card rounded-lg shadow-lg min-w-fit">
      <div className="flex flex-col gap-4 p-4">
        <h3 className="text-base font-bold text-primary">Configuration</h3>
        <div className="flex flex-col justify-start lg:flex-row gap-4">
          <Button
            variant="primary"
            onClick={() => navigate('/data-package')}
            className="w-full lg:w-auto"
          >
            Generate Data Package
          </Button>
          <Button
            variant="primary" 
            onClick={() => console.log('make certs')}
            className="w-full lg:w-auto"
          >
            Generate Certs
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Configuration; 