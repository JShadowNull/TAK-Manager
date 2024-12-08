import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import CustomScrollbar from '../CustomScrollbar';
import InputField from '../InputField';

function ExistingCertificates({
  isLoading,
  onCreateDataPackage
}) {
  const [localCertificates, setLocalCertificates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCerts, setSelectedCerts] = useState(new Set());
  const [deletingCerts, setDeletingCerts] = useState(new Set());
  const socketRef = useRef(null);

  // Handle select/unselect all
  const handleSelectAll = () => {
    if (selectedCerts.size === filteredCertificates.length) {
      setSelectedCerts(new Set());
    } else {
      setSelectedCerts(new Set(filteredCertificates.map(cert => cert.identifier)));
    }
  };

  // Handle individual certificate selection
  const handleSelectCert = (certId) => {
    const newSelected = new Set(selectedCerts);
    if (newSelected.has(certId)) {
      newSelected.delete(certId);
    } else {
      newSelected.add(certId);
    }
    setSelectedCerts(newSelected);
  };

  // Handle certificate deletion
  const deleteCertificate = async (username) => {
    try {
      setDeletingCerts(prev => new Set([...prev, username]));
      setupSocket();

      const response = await fetch('/api/certmanager/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernames: [username]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete certificate: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Error deleting certificate:', error);
    }
  };

  // Handle multiple certificate deletion
  const handleDeleteSelected = async () => {
    try {
      const selectedArray = Array.from(selectedCerts);
      for (const username of selectedArray) {
        setDeletingCerts(prev => new Set([...prev, username]));
      }

      setupSocket();
      const response = await fetch('/api/certmanager/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernames: selectedArray
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete certificates: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }

    } catch (error) {
      console.error('Error deleting certificates:', error);
    }
  };

  const setupSocket = () => {
    if (!socketRef.current) {
      socketRef.current = io('/cert-manager', {
        transports: ['websocket'],
        reconnection: false
      });
      
      socketRef.current.on('cert_operation', (data) => {
        console.log('Received cert operation:', data);
        
        if (data.type === 'delete') {
          switch (data.status) {
            case 'started':
            case 'in_progress':
              // Keep the loading state
              break;
              
            case 'completed':
              // Remove from deleting state
              setDeletingCerts(prev => {
                const newDeleting = new Set(prev);
                newDeleting.delete(data.username);
                return newDeleting;
              });
              // Remove from selected if it was selected
              setSelectedCerts(prev => {
                const newSelected = new Set(prev);
                newSelected.delete(data.username);
                return newSelected;
              });
              break;
              
            case 'failed':
              // Remove from deleting state on failure
              setDeletingCerts(prev => {
                const newDeleting = new Set(prev);
                newDeleting.delete(data.username);
                return newDeleting;
              });
              break;
          }
        }
      });

      socketRef.current.on('certificates_data', (data) => {
        if (data.certificates && Array.isArray(data.certificates)) {
          setLocalCertificates(data.certificates);
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setDeletingCerts(new Set());
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
        setDeletingCerts(new Set());
      });
    }
  };

  const cleanupSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
        socketRef.current = null;
      } catch (error) {
        console.error('Error cleaning up socket:', error);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    setupSocket(); // Initial socket setup for certificates data
    return () => {
      cleanupSocket();
    };
  }, []);

  // Filter certificates based on search term
  const filteredCertificates = localCertificates.filter(cert =>
    cert.identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Trashcan SVG icon component
  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>
  );

  // Loading spinner component
  const LoadingSpinner = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
              className={`text-buttonTextColor rounded-lg px-3 py-2 text-sm border border-buttonBorder bg-buttonColor 
                ${selectedCerts.size === deletingCerts.size ? 'opacity-50 cursor-not-allowed' : 'hover:text-black hover:shadow-md hover:border-black hover:bg-red-500'} 
                transition-all duration-200`}
              onClick={handleDeleteSelected}
              disabled={selectedCerts.size === deletingCerts.size}
            >
              {selectedCerts.size === deletingCerts.size ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner />
                  <span>Deleting...</span>
                </div>
              ) : (
                `Delete Selected (${selectedCerts.size})`
              )}
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
                {searchTerm ? 'No matching certificates found' : 'No certificates found'}
              </div>
            ) : (
              filteredCertificates.map((cert) => (
                <div key={cert.identifier} className="flex justify-between items-center p-2 border border-accentBoarder rounded bg-primaryBg">
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(cert.identifier)}
                      onChange={() => handleSelectCert(cert.identifier)}
                      className="w-4 h-4 rounded border-gray-300"
                      disabled={deletingCerts.has(cert.identifier)}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-textPrimary font-medium">{cert.identifier}</span>
                        {cert.role === 'ROLE_ADMIN' && (
                          <span className="text-sm text-blue-500 font-medium">(Admin)</span>
                        )}
                        {cert.passwordHashed && (
                          <span className="text-sm text-green-500" title="User has password set">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      {cert.groups && cert.groups.length > 0 && (
                        <div className="text-sm text-gray-400 flex gap-1 flex-wrap mt-1">
                          {cert.groups.map((group, index) => (
                            <span 
                              key={index}
                              className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded-full text-xs"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor ml-4
                      ${deletingCerts.has(cert.identifier) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:text-black hover:shadow-md hover:border-black hover:bg-red-500'} 
                      transition-all duration-200`}
                    onClick={() => deleteCertificate(cert.identifier)}
                    disabled={deletingCerts.has(cert.identifier)}
                    title={deletingCerts.has(cert.identifier) ? "Deleting..." : "Delete certificate"}
                  >
                    {deletingCerts.has(cert.identifier) ? <LoadingSpinner /> : <TrashIcon />}
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