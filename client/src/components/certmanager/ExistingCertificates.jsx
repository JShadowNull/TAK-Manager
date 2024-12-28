import React, { useState, useEffect, useMemo } from 'react';
import CustomScrollbar from '../shared/ui/layout/CustomScrollbar';
import { Input } from '../shared/ui/shadcn/input';
import { Chip, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import useFetch from '../shared/hooks/useFetch';
import { Button } from '../shared/ui/shadcn/button';
import LoadingButton from '../shared/ui/inputs/LoadingButton';

function ExistingCertificates({
  certificates,
  isLoading,
  onCreateDataPackage,
  onOperationProgress,
  isConnected
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCerts, setSelectedCerts] = useState(new Set());
  const [operationStatus, setOperationStatus] = useState(null);

  const { delete: deleteRequest } = useFetch();

  // Debug connection status
  useEffect(() => {
    console.log('Socket connection status:', isConnected);
  }, [isConnected]);

  // Filter certificates based on search term
  const filteredCertificates = useMemo(() => {
    return certificates.filter(cert =>
      cert.identifier.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [certificates, searchTerm]);

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

  // Handle operation status updates from WebSocket
  useEffect(() => {
    if (typeof onOperationProgress === 'function') {
      // If it's a function, call it to get the data
      const data = onOperationProgress();
      console.log('🔄 Operation Progress Data:', data);
      
      if (data?.operation === 'deletion_operation') {
        setOperationStatus(data);
        if (data.status === 'complete') {
          setTimeout(() => {
            setSelectedCerts(new Set());
            setOperationStatus(null);
          }, 1000);
        }
      }
    } else if (onOperationProgress?.operation === 'deletion_operation') {
      // Handle direct object updates
      setOperationStatus(onOperationProgress);
      if (onOperationProgress.status === 'complete') {
        setTimeout(() => {
          setSelectedCerts(new Set());
          setOperationStatus(null);
        }, 1000);
      }
    }
  }, [onOperationProgress]);

  // Handle certificate deletion
  const deleteCertificate = async (username) => {
    try {
      // Set initial loading state immediately
      setOperationStatus({
        operation: 'deletion_operation',
        status: 'started',
        message: 'Starting deletion',
        details: {
          total_certs: 1,
          completed_certs: 0,
          current_cert: username
        },
        progress: 0
      });

      const result = await deleteRequest('/certmanager/certmanager/delete', {
        usernames: [username]
      });
      
      if (!result || result.error) {
        throw new Error(result?.error || 'Failed to delete certificate');
      }
    } catch (error) {
      console.error('Error deleting certificate:', error);
      setOperationStatus({
        operation: 'deletion_operation',
        status: 'failed',
        message: error.message || 'Failed to delete certificate',
        details: {
          total_certs: 1,
          completed_certs: 0
        },
        progress: 0
      });
    }
  };

  // Handle multiple certificate deletion
  const handleDeleteSelected = async () => {
    try {
      const selectedArray = Array.from(selectedCerts);
      
      // Set initial loading state immediately
      setOperationStatus({
        operation: 'deletion_operation',
        status: 'started',
        message: `Starting deletion of ${selectedArray.length} certificate(s)`,
        details: {
          total_certs: selectedArray.length,
          completed_certs: 0
        },
        progress: 0
      });

      const result = await deleteRequest('/certmanager/certmanager/delete', {
        usernames: selectedArray
      });

      if (!result || result.error) {
        throw new Error(result?.error || 'Failed to delete certificates');
      }
    } catch (error) {
      console.error('Error deleting certificates:', error);
      setOperationStatus({
        operation: 'deletion_operation',
        status: 'failed',
        message: error.message || 'Failed to delete certificates',
        details: {
          total_certs: selectedCerts.size,
          completed_certs: 0
        },
        progress: 0
      });
    }
  };

  // Determine if operation is in deleting state
  const isDeleting = operationStatus?.operation === 'deletion_operation' && 
                    ['started', 'in_progress'].includes(operationStatus?.status);

  // Debug operation status changes
  useEffect(() => {
    console.log('🔄 Operation Status Changed:', {
      operation: operationStatus?.operation,
      status: operationStatus?.status,
      isDeleting,
      timestamp: new Date().toISOString()
    });
  }, [operationStatus, isDeleting]);

  // Debug loading state changes
  useEffect(() => {
    console.log('🔍 Loading State Changed:', {
      isDeleting,
      operationStatus: {
        operation: operationStatus?.operation,
        status: operationStatus?.status,
        message: operationStatus?.message,
        progress: operationStatus?.progress
      },
      selectedCertsSize: selectedCerts.size,
      timestamp: new Date().toISOString()
    });
  }, [isDeleting, operationStatus, selectedCerts]);

  // Debug render cycle
  console.log('🔄 Component Render:', {
    isDeleting,
    operationStatus: operationStatus ? {
      operation: operationStatus.operation,
      status: operationStatus.status,
      message: operationStatus.message
    } : null,
    selectedCertsSize: selectedCerts.size,
    timestamp: new Date().toISOString()
  });

  return (
    <div className="border border-border bg-background p-4 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-primary">Existing Certificates</h3>
        <div className="w-full max-w-[30rem] p-2">
          <Input
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-sidebar border-border"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleSelectAll}
          >
            {selectedCerts.size === filteredCertificates.length && filteredCertificates.length > 0 
              ? 'Deselect All' 
              : 'Select All'}
          </Button>
          
          {selectedCerts.size > 0 && (
            <LoadingButton
              variant="primary"
              operation="deletion_operation"
              isLoading={isDeleting}
              status={operationStatus?.status}
              message={operationStatus?.message}
              progress={operationStatus?.progress}
              showProgress={true}
              progressType="percentage"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              loadingMessage={`Deleting (${operationStatus?.details?.completed_certs || 0}/${operationStatus?.details?.total_certs || 0})`}
              successMessage="Deletion complete"
              failedMessage="Deletion failed"
            >
              Delete Selected ({selectedCerts.size})
            </LoadingButton>
          )}
          
          <Button
            variant="primary"
            onClick={onCreateDataPackage}
          >
            Create Data Packages
          </Button>
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
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-sidebar transition-all duration-200"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(cert.identifier)}
                      onChange={() => handleSelectCert(cert.identifier)}
                      className="w-4 h-4 rounded border-border bg-background"
                      disabled={isDeleting && operationStatus?.details?.current_cert === cert.identifier}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{cert.identifier}</span>
                      {cert.role === 'ROLE_ADMIN' && (
                        <span className="text-sm text-primary">(Admin)</span>
                      )}
                      <Tooltip title={cert.passwordHashed ? "Password Protected" : "No Password Set"} arrow>
                        <div className="flex items-center gap-1">
                          {cert.passwordHashed ? (
                            <>
                              <LockIcon sx={{ 
                                fontSize: 16, 
                                color: 'hsl(var(--muted-foreground))'
                              }} />
                              <span className="text-xs text-muted-foreground">Password Configured</span>
                            </>
                          ) : (
                            <>
                              <LockOpenIcon sx={{ 
                                fontSize: 16, 
                                color: 'hsl(var(--muted-foreground))'
                              }} />
                              <span className="text-xs text-muted-foreground">No Password</span>
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
                  <LoadingButton
                    variant="ghost"
                    operation="deletion_operation"
                    isLoading={isDeleting && operationStatus?.details?.current_cert === cert.identifier}
                    status={operationStatus?.status}
                    message={operationStatus?.message}
                    showProgress={true}
                    progressType="spinner"
                    onClick={() => deleteCertificate(cert.identifier)}
                    disabled={isDeleting}
                    tooltip={isDeleting ? operationStatus?.message : "Delete certificate"}
                    iconOnly
                  >
                    <DeleteOutlineIcon className="h-5 w-5" />
                  </LoadingButton>
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