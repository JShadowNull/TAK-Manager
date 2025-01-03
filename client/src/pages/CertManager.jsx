import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';
import useSocket from '../components/shared/hooks/useSocket';

function CertManager() {
  const navigate = useNavigate();
  const [operationStatus, setOperationStatus] = useState(null);

  // Initialize socket connection with proper event handlers
  const { state, isConnected } = useSocket('/cert-manager', {
    initialState: {
      certificates: []
    },
    eventHandlers: {
      // Initial state handler
      initial_state: (data) => {
        console.log('Received initial state:', data);
      },
      // Certificate updates handler
      certificates_data: (data) => {
        console.log('Received certificate update:', data);
      },
      // Error handler
      certificates_error: (error) => {
        console.error('Certificate error:', error);
      },
      // Operation status handler for both creation and deletion
      operation_status: (data) => {
        console.log('Operation status update:', data);
        setOperationStatus(data);
      }
    },
    autoConnect: true
  });

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

  // Pass operation progress to child components
  const handleOperationProgress = () => {
    return operationStatus;
  };

  return (
    <div className="flex flex-col gap-4 p-2 md:p-4 sm:p-6">
      {/* Certificate Creation Section */}
      <CreateCertificates 
        onOperationProgress={handleOperationProgress}
        isConnected={isConnected}
      />

      {/* Existing Certificates Section */}
      <ExistingCertificates
        certificates={state.certificates}
        onCreateDataPackage={handleBatchDataPackage}
        onOperationProgress={handleOperationProgress}
        isConnected={isConnected}
      />
    </div>
  );
}

export default CertManager; 