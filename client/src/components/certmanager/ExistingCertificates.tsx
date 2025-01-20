import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Input } from '../shared/ui/shadcn/input';
import { Chip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../shared/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import CertificateOperationPopups from './CertificateOperationPopups';

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

type Operation = 'delete_certs' | 'delete_certs_batch' | null;

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
  const [certificates, setCertificates] = useState<Certificate[]>(initialCertificates);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [certToDelete, setCertToDelete] = useState<string>();
  const [successfulDelete, setSuccessfulDelete] = useState<string | null>(null);
  const [deletingCerts, setDeletingCerts] = useState<Set<string>>(new Set());

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
    console.debug('[ExistingCertificates] Starting EventSource connection');
    const eventSource = new EventSource('/api/certmanager/certificates/status-stream');

    eventSource.addEventListener('certificate-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.debug('[ExistingCertificates] Status event received:', data);
        
        // Handle certificate updates
        if (data.type === 'certificates_update' && Array.isArray(data.certificates)) {
          console.debug('[ExistingCertificates] Updating certificates list');
          setCertificates(data.certificates);
        }
        
        // Handle operation status
        if (data.type === 'status') {
          // Handle operation start
          if (data.status === 'in_progress') {
            console.debug('[ExistingCertificates] Operation in progress:', data.operation);
            
            if (data.operation === 'delete_certs_batch') {
              // Start of batch delete
              console.debug('[ExistingCertificates] Starting batch delete');
              setCurrentOperation('delete_certs_batch');
              setIsOperationInProgress(true);
            } 
            else if (data.operation === 'delete_certs' && data.details?.username) {
              // Individual cert deletion (either standalone or part of batch)
              if (currentOperation === 'delete_certs_batch') {
                // Part of batch delete - just add to deleting certs
                console.debug('[ExistingCertificates] Adding cert to deleting set:', data.details.username);
                setDeletingCerts(prev => new Set([...prev, data.details.username]));
              } else {
                // Standalone delete
                console.debug('[ExistingCertificates] Starting individual delete:', data.details.username);
                setCurrentOperation('delete_certs');
                setIsOperationInProgress(true);
                setDeletingCerts(new Set([data.details.username]));
              }
            }
          }
          
          // Handle operation completion
          if (data.status === 'complete' || data.status === 'error') {
            console.debug('[ExistingCertificates] Operation completed/errored:', data.operation);
            
            if (data.error) {
              setError(data.error);
              setSuccessfulDelete(null);
              setDeletingCerts(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
            } else {
              setError(null);
              
              if (data.operation === 'delete_certs' && data.details?.username) {
                // Individual delete completion
                console.debug('[ExistingCertificates] Individual delete completed:', data.details.username);
                setSuccessfulDelete(data.details.username);
                setDeletingCerts(prev => {
                  const next = new Set(prev);
                  next.delete(data.details.username);
                  return next;
                });
                
                if (currentOperation !== 'delete_certs_batch') {
                  // Only clear states if not part of batch
                  setIsOperationInProgress(false);
                  setCurrentOperation(null);
                  
                  // Refresh after individual delete
                  setTimeout(() => {
                    console.debug('[ExistingCertificates] Clearing success state and refreshing');
                    setSuccessfulDelete(null);
                    fetchCertificates();
                  }, 2000);
                }
              }
              
              if (data.operation === 'delete_certs_batch') {
                // Batch delete completion
                console.debug('[ExistingCertificates] Batch delete completed, refreshing certificates');
                setDeletingCerts(new Set());
                setSelectedCerts(new Set());
                setIsOperationInProgress(false);
                setCurrentOperation(null);
                setSuccessfulDelete(null);
                fetchCertificates();
              }
            }
          }
          
          if (onOperationProgress) {
            onOperationProgress(data);
          }
        }
      } catch (error) {
        console.error('[ExistingCertificates] Error processing status:', error);
        setIsOperationInProgress(false);
        setCurrentOperation(null);
        setSuccessfulDelete(null);
        setDeletingCerts(new Set());
      }
    });

    eventSource.onerror = (error) => {
      console.error('[ExistingCertificates] SSE connection error:', error);
      setTimeout(() => {
        eventSource.close();
      }, 5000);
    };

    return () => {
      console.debug('[ExistingCertificates] Closing EventSource connection');
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
      console.error('[ExistingCertificates] Operation error:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      setSuccessfulDelete(null);
      setDeletingCerts(new Set());
    }
  };

  const handleDeleteClick = (username: string) => {
    setCertToDelete(username);
    setShowSingleDeleteConfirm(true);
  };

  const handleBatchDeleteClick = () => {
    setShowBatchDeleteConfirm(true);
  };

  const handleSingleDeleteConfirm = () => {
    if (certToDelete) {
      handleOperation('delete_certs', certToDelete);
      setShowSingleDeleteConfirm(false);
    }
  };

  const handleBatchDeleteConfirm = () => {
    handleOperation('delete_certs_batch');
    setShowBatchDeleteConfirm(false);
  };

  const handleCloseConfirm = () => {
    setShowSingleDeleteConfirm(false);
    setShowBatchDeleteConfirm(false);
    setCertToDelete(undefined);
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Existing Certificates</CardTitle>
        <CardDescription>Manage and view your existing TAK certificates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
            <div className="w-full md:max-w-[30rem]">
              <Input
                type="text"
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
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
                  onClick={handleBatchDeleteClick}
                  disabled={isOperationInProgress}
                  loading={currentOperation === 'delete_certs_batch'}
                  loadingText={`Deleting ${selectedCerts.size} certificates...`}
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
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="h-[400px] border rounded-lg">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                {isLoading ? (
                  <div className="text-center text-muted-foreground py-4">
                    Loading certificates...
                  </div>
                ) : filteredCertificates.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    {searchTerm ? 'No matching certificates found' : 'No certificates found'}
                  </div>
                ) : (
                  filteredCertificates.map((cert) => (
                    <div 
                      key={cert.identifier} 
                      className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted transition-all duration-200 gap-2"
                    >
                      <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        <Checkbox
                          checked={selectedCerts.has(cert.identifier)}
                          onCheckedChange={() => handleSelectCert(cert.identifier)}
                          disabled={isOperationInProgress}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{cert.identifier}</span>
                          {cert.role === 'ROLE_ADMIN' && (
                            <span className="text-sm text-primary">(Admin)</span>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-pointer">
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
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{cert.passwordHashed ? "Password Protected" : "No Password Set"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {cert.groups.map((group, index) => (
                            <Chip
                              key={index}
                              label={group}
                              size="small"
                              sx={{
                                backgroundColor: 'hsl(var(--muted))',
                                color: 'hsl(var(--muted-foreground))',
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
                        onClick={() => handleDeleteClick(cert.identifier)}
                        disabled={isOperationInProgress}
                        className="relative"
                      >
                        {(isOperationInProgress && currentOperation === 'delete_certs' && certToDelete === cert.identifier) || 
                         (currentOperation === 'delete_certs_batch' && deletingCerts.has(cert.identifier)) ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : successfulDelete === cert.identifier ? (
                          <Check className="h-5 w-5 text-primary" />
                        ) : (
                          <DeleteOutlineIcon className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>

      <CertificateOperationPopups
        showSingleDeleteConfirm={showSingleDeleteConfirm}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        selectedCertName={certToDelete}
        selectedCount={selectedCerts.size}
        onSingleDeleteConfirm={handleSingleDeleteConfirm}
        onBatchDeleteConfirm={handleBatchDeleteConfirm}
        onClose={handleCloseConfirm}
      />
    </Card>
  );
};

export default ExistingCertificates; 