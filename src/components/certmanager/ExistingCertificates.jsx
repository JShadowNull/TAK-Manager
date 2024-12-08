import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import CustomScrollbar from '../CustomScrollbar';
import InputField from '../InputField';

function ExistingCertificates({
  certificates,
  isLoading,
  onDeleteCertificate,
  onCreateDataPackage
}) {
  const [localCertificates, setLocalCertificates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCerts, setSelectedCerts] = useState(new Set());
  
  // Filter and process certificates
  const processCertificates = (files) => {
    if (!Array.isArray(files)) return [];

    // Filter out system certificates and extract unique user certificates
    const userCerts = new Map();

    files.forEach(file => {
      // Skip system certificates and non-user files
      if (file.toLowerCase().startsWith('ca') ||
          file.toLowerCase().startsWith('root-') ||
          file.toLowerCase().startsWith('intermediate') ||
          file.toLowerCase().startsWith('takserver') ||
          file.toLowerCase().startsWith('fed-') ||
          file.toLowerCase().startsWith('truststore-') ||
          file.endsWith('.crl') ||
          file.endsWith('.csr') ||
          file === 'config-takserver.cfg' ||
          file.startsWith('crl_index')) {
        return;
      }

      // Extract base name (remove file extension and special suffixes)
      let baseName = file.replace(/\.(pem|key|p12|jks|csr)$/, '')  // Remove file extensions
                        .replace(/-trusted$/, '');                   // Remove -trusted suffix

      // Store unique certificate info
      if (!userCerts.has(baseName)) {
        userCerts.set(baseName, {
          name: baseName
        });
      }
    });

    return Array.from(userCerts.values());
  };

  // Handle select/unselect all
  const handleSelectAll = () => {
    if (selectedCerts.size === filteredCertificates.length) {
      setSelectedCerts(new Set());
    } else {
      setSelectedCerts(new Set(filteredCertificates.map(cert => cert.name)));
    }
  };

  // Handle individual certificate selection
  const handleSelectCert = (certName) => {
    const newSelected = new Set(selectedCerts);
    if (newSelected.has(certName)) {
      newSelected.delete(certName);
    } else {
      newSelected.add(certName);
    }
    setSelectedCerts(newSelected);
  };

  // Handle multiple certificate deletion
  const handleDeleteSelected = () => {
    selectedCerts.forEach(certName => {
      onDeleteCertificate(certName);
    });
    setSelectedCerts(new Set());
  };

  // Filter certificates based on search term
  const filteredCertificates = localCertificates.filter(cert =>
    cert.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Create socket connection to backend
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io('/data-package', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Listen for certificate updates
    socket.on('connect', () => {
      console.log('Connected to data package service');
      socket.emit('get_certificate_files');
    });

    socket.on('certificate_files', (data) => {
      if (data.files && Array.isArray(data.files)) {
        const processedCerts = processCertificates(data.files);
        setLocalCertificates(processedCerts);
      }
    });

    socket.on('certificate_files_error', (data) => {
      console.error('Error getting certificate files:', data.error);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Trashcan SVG icon component
  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>
  );

  return (
    <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg">
      <div className="flex items-center mb-4 gap-4">
        <h3 className="text-base font-bold whitespace-nowrap">Existing Certificates</h3>
        <div className="flex-1 mx-4">
          <InputField
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 items-center">
          <button
            className="text-buttonTextColor rounded-lg px-3 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-blue-500 transition-all duration-200"
            onClick={handleSelectAll}
          >
            {selectedCerts.size === filteredCertificates.length && filteredCertificates.length > 0 
              ? 'Deselect All' 
              : 'Select All'}
          </button>
          {selectedCerts.size > 0 && (
            <button
              className="text-buttonTextColor rounded-lg px-3 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
              onClick={handleDeleteSelected}
              disabled={isLoading}
            >
              Delete Selected ({selectedCerts.size})
            </button>
          )}
          <button
            className="text-buttonTextColor rounded-lg px-3 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-blue-500 transition-all duration-200"
            onClick={onCreateDataPackage}
          >
            Create Data Packages
          </button>
        </div>
      </div>

      <div className="h-[400px]">
        <CustomScrollbar>
          <div className="space-y-2">
            {filteredCertificates.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                {searchTerm ? 'No matching certificates found' : 'No user certificates found'}
              </div>
            ) : (
              filteredCertificates.map((cert) => (
                <div key={cert.name} className="flex justify-between items-center p-2 border border-accentBoarder rounded bg-primaryBg">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(cert.name)}
                      onChange={() => handleSelectCert(cert.name)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-textPrimary">{cert.name}</span>
                  </div>
                  <button
                    className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                    onClick={() => onDeleteCertificate(cert.name)}
                    disabled={isLoading}
                    title="Delete certificate"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
}

export default ExistingCertificates; 