import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Input } from '../shared/ui/shadcn/input';
import { Chip, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { Button } from '../shared/ui/shadcn/button';

interface Certificate {
  identifier: string;
  role: string;
  passwordHashed: boolean;
  groups: string[];
}

interface ExistingCertificatesProps {
  onCreateDataPackage: () => void;
  certificates: Certificate[];
  onOperationProgress?: (data: any) => void;
  isLoading?: boolean;
}

type Operation = 'delete' | 'delete_batch' | null;

const ExistingCertificates: React.FC<ExistingCertificatesProps> = ({
  onCreateDataPackage,
  certificates: initialCertificates = [],
  onOperationProgress,
  isLoading: initialLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCerts, setSelectedCerts] = useState<Set<string>>(new Set());
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<any>(null);
  const [certificates, setCertificates] = useState<Certificate[]>(initialCertificates);
  const [isLoading, setIsLoading] = useState(initialLoading);

  // Fetch certificates
  const fetchCertificates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/certmanager/certificates');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.certificates)) {
        setCertificates(data.certificates);
      } else {
        console.error('Invalid certificate data received:', data);
      }
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setError('Failed to fetch certificates');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCertificates();
  }, []);

  // Setup SSE for certificate status updates
  useEffect(() => {
    const eventSource = new EventSource('/api/certmanager/certificates/status-stream');

    eventSource.addEventListener('certificate-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle certificate updates
        if (data.type === 'certificates_update' && Array.isArray(data.certificates)) {
          setCertificates(data.certificates);
        }
        
        // Handle operation status
        if (data.type === 'status') {
          if (data.status === 'complete' || data.status === 'error') {
            setIsOperationInProgress(false);
            setCurrentOperation(null);
            if (data.error) {
              setError(data.error);
            } else {
              setError(null);
              // Reset selection after successful operation
              setSelectedCerts(new Set());
            }
          }
          
          setOperationStatus(data);
          
          // Forward progress to parent if needed
          if (onOperationProgress) {
            onOperationProgress(data);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        setIsOperationInProgress(false);
        setCurrentOperation(null);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        eventSource.close();
        // The browser will automatically attempt to reconnect
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [onOperationProgress]);

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
  const handleSelectCert = (certId: string) => {
    const newSelected = new Set(selectedCerts);
    if (newSelected.has(certId)) {
      newSelected.delete(certId);
    } else {
      newSelected.add(certId);
    }
    setSelectedCerts(newSelected);
  };

  const handleOperation = async (operation: Operation, username?: string) => {
    try {
      setError(null);
      setCurrentOperation(operation);
      setIsOperationInProgress(true);

      const response = await fetch('/api/certmanager/certificates/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernames: username ? [username] : Array.from(selectedCerts)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete certificate(s)');
      }
    } catch (error) {
      console.error('Operation error:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
    }
  };

  const handleDeleteSingle = (username: string) => handleOperation('delete', username);
  const handleDeleteSelected = () => handleOperation('delete_batch');

  return (
    <div className="border border-border bg-background p-2 md:p-4 rounded-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 mb-4">
        <h3 className="text-base font-bold text-primary">Existing Certificates</h3>
        <div className="w-full md:max-w-[30rem] p-0 md:p-2">
          <Input
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-sidebar border-border"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={isOperationInProgress}
          >
            {selectedCerts.size === filteredCertificates.length && filteredCertificates.length > 0 
              ? 'Deselect All' 
              : 'Select All'}
          </Button>
          
          {selectedCerts.size > 0 && (
            <Button
              variant="danger"
              onClick={handleDeleteSelected}
              disabled={isOperationInProgress}
              loading={currentOperation === 'delete_batch'}
              loadingText={`Deleting (${operationStatus?.details?.completed || 0}/${operationStatus?.details?.total || 0})`}
            >
              Delete Selected ({selectedCerts.size})
            </Button>
          )}
          
          <Button
            variant="primary"
            onClick={onCreateDataPackage}
            disabled={isOperationInProgress}
          >
            Create Data Packages
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-2">{error}</p>
      )}

      <div className="h-[400px]">
        <ScrollArea>
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center text-textSecondary py-4">
                Loading certificates...
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="text-center text-textSecondary py-4">
                {searchTerm ? 'No matching certificates found' : 'No certificates found'}
              </div>
            ) : (
              filteredCertificates.map((cert) => (
                <div 
                  key={cert.identifier} 
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border border-border rounded-lg bg-sidebar transition-all duration-200 gap-2"
                >
                  <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                    <input
                      type="checkbox"
                      checked={selectedCerts.has(cert.identifier)}
                      onChange={() => handleSelectCert(cert.identifier)}
                      className="w-4 h-4 rounded border-border bg-background"
                      disabled={isOperationInProgress}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-medium">{cert.identifier}</span>
                      {cert.role === 'ROLE_ADMIN' && (
                        <span className="text-sm text-primary">(Admin)</span>
                      )}
                      <Tooltip title={cert.passwordHashed ? "Password Protected" : "No Password Set"} arrow>
                        <div className="flex items-center gap-1">
                          {cert.passwordHashed ? (
                            <>
                              <LockIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
                              <span className="text-xs text-muted-foreground">Password Configured</span>
                            </>
                          ) : (
                            <>
                              <LockOpenIcon sx={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }} />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSingle(cert.identifier)}
                    disabled={isOperationInProgress}
                    loading={currentOperation === 'delete' && operationStatus?.details?.username === cert.identifier}
                    loadingText="Deleting"
                  >
                    <DeleteOutlineIcon className="h-5 w-5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ExistingCertificates; 