import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';

function CertManager() {
  const navigate = useNavigate();
  const [operationStatus, setOperationStatus] = useState(null);

  const certData = { certificates: [] }; // Default or mock data
  const isConnected = false; // Default connection status

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

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
        certificates={certData.certificates}
        onCreateDataPackage={handleBatchDataPackage}
        onOperationProgress={handleOperationProgress}
        isConnected={isConnected}
      />
    </div>
  );
}

export default CertManager; 