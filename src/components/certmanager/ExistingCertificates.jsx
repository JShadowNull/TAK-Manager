import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import CustomScrollbar from '../shared/ui/CustomScrollbar';
import { Input } from '../shared/ui/shadcn/input';
import { Chip, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CircularProgress from '@mui/material/CircularProgress';

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

      const response = await fetch('/certmanager/delete', {
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
      const response = await fetch('/certmanager/delete', {
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
        setDeletingCerts(new Set());
      });

      socketRef.current.on('error', (error) => {
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

  // Loading spinner component using MUI
  const LoadingSpinner = () => (
    <CircularProgress size={20} thickness={4} sx={{ color: 'inherit' }} />
  );

  return (
    <div className="border border-border bg-card p-4 rounded-lg">
      <div className="flex items-center mb-4 gap-4">
        <h3 className="text-base font-bold text-foreground">Existing Certificates</h3>
        <div className="flex-1 mx-4">
          <Input
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border-border"
          />
        </div>
        <div className="flex gap-2 items-center">
          <button
            className="text-primary-foreground rounded-lg px-3 py-2 text-sm border border-border bg-primary hover:bg-buttonHoverColor transition-all duration-200"
            onClick={handleSelectAll}
          >
            {selectedCerts.size === filteredCertificates.length && filteredCertificates.length > 0 
              ? 'Deselect All' 
              : 'Select All'}
          </button>
          {selectedCerts.size > 0 && (
            <button
              className={`text-primary-foreground rounded-lg px-3 py-2 text-sm border border-border bg-primary 
                ${selectedCerts.size === deletingCerts.size ? 'opacity-50 cursor-not-allowed' : 'hover:bg-buttonHoverColor'} 
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
            className="text-primary-foreground rounded-lg px-3 py-2 text-sm border border-border bg-primary hover:bg-buttonHoverColor transition-all duration-200"
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
              <div className="text-center text-textSecondary py-4">
                {searchTerm ? 'No matching certificates found' : 'No certificates found'}
              </div>
            ) : (
              filteredCertificates.map((cert) => (
                <div 
                  key={cert.identifier} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-primary transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(cert.identifier)}
                      onChange={() => handleSelectCert(cert.identifier)}
                      className="w-4 h-4 rounded border-border bg-background"
                      disabled={deletingCerts.has(cert.identifier)}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{cert.identifier}</span>
                      {cert.role === 'ROLE_ADMIN' && (
                        <span className="text-sm text-accentBlue">(Admin)</span>
                      )}
                      <Tooltip title={cert.passwordHashed ? "Password Protected" : "No Password Set"} arrow>
                        <div className="flex items-center gap-1">
                          {cert.passwordHashed ? (
                            <>
                              <LockIcon sx={{ 
                                fontSize: 16, 
                                color: 'rgba(106, 167, 248, 1.000)', // accentBlue
                              }} />
                              <span className="text-xs text-accentBlue">Password Configured</span>
                            </>
                          ) : (
                            <>
                              <LockOpenIcon sx={{ 
                                fontSize: 16, 
                                color: 'rgba(86, 119, 153, 1.000)', // textSecondary
                              }} />
                              <span className="text-xs text-textSecondary">No Password</span>
                            </>
                          )}
                        </div>
                      </Tooltip>
                      {cert.groups.map((group, index) => (
                        <Chip
                          key={index}
                          label={group}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(4, 28, 47, 1.000)',
                            color: 'rgba(208, 219, 229, 1.000)',
                            height: '20px',
                            fontSize: '0.75rem',
                            '& .MuiChip-label': {
                              padding: '0 8px',
                            },
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    className={`p-2 rounded-lg text-primary-foreground hover:text-foreground hover:bg-primary transition-all duration-200
                      ${deletingCerts.has(cert.identifier) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => deleteCertificate(cert.identifier)}
                    disabled={deletingCerts.has(cert.identifier)}
                    title={deletingCerts.has(cert.identifier) ? "Deleting..." : "Delete certificate"}
                  >
                    {deletingCerts.has(cert.identifier) ? 
                      <LoadingSpinner /> : 
                      <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                    }
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