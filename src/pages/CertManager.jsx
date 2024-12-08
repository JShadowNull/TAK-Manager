import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';

function CertManager() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Certificate Creation Section */}
      <CreateCertificates />

      {/* Existing Certificates Section */}
      <ExistingCertificates
        certificates={certificates}
        onCreateDataPackage={handleBatchDataPackage}
      />
    </div>
  );
}

export default CertManager; 