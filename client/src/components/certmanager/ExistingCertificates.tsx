import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Input } from '../shared/ui/shadcn/input';
import { Chip } from '@mui/material';
import { Check, Loader2, ArrowDownToLine, LockKeyhole, LockKeyholeOpen, Trash2} from 'lucide-react';
import { Button } from '../shared/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import CertificateOperationPopups from './CertificateOperationPopups';
import { useNavigate } from 'react-router-dom';

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

type Operation = 'delete_certs' | 'delete_certs_batch' | 'download' | 'download_batch' | null;

const ExistingCertificates: React.FC<ExistingCertificatesProps> = ({
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
  const [downloadingCerts, setDownloadingCerts] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

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

    eventSource.addEventListener('certificate-status', async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle certificate updates
        if (data.type === 'certificates_update' && Array.isArray(data.certificates)) {
          setCertificates(data.certificates);
        }
        
        // Handle terminal messages for downloads
        if (data.type === 'terminal' && !data.isError && currentOperation === 'download_batch') {
          const match = data.message.match(/\/([^\/]+)\.p12$/);
          if (match) {
            const username = match[1];
            const response = await fetch('/api/certmanager/certificates/download', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                usernames: [username]
              })
            });

            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${username}.p12`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              setDownloadingCerts(prev => {
                const next = new Set(prev);
                next.delete(username);
                return next;
              });
            }
          }
        }
        
        // Handle operation status
        if (data.type === 'status') {
          // Handle operation start
          if (data.status === 'in_progress') {
            if (data.operation === 'delete_certs_batch') {
              setCurrentOperation('delete_certs_batch');
              setIsOperationInProgress(true);
            } 
            else if (data.operation === 'delete_certs' && data.details?.username) {
              if (currentOperation === 'delete_certs_batch') {
                setDeletingCerts(prev => new Set([...prev, data.details.username]));
              } else {
                setCurrentOperation('delete_certs');
                setIsOperationInProgress(true);
                setDeletingCerts(new Set([data.details.username]));
              }
            }
            else if (data.operation === 'download_batch') {
              setCurrentOperation('download_batch');
              setIsOperationInProgress(true);
            }
            else if (data.operation === 'download' && data.details?.username) {
              if (currentOperation === 'download_batch') {
                setDownloadingCerts(prev => new Set([...prev, data.details.username]));
              } else {
                setCurrentOperation('download');
                setIsOperationInProgress(true);
                setDownloadingCerts(new Set([data.details.username]));
              }
            }
          }
          
          // Handle operation completion
          if (data.status === 'complete') {
            if (data.operation === 'download_batch') {
              setDownloadingCerts(new Set());
              setSelectedCerts(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
            }
            else if (data.operation === 'delete_certs' && data.details?.username) {
              setSuccessfulDelete(data.details.username);
              setDeletingCerts(prev => {
                const next = new Set(prev);
                next.delete(data.details.username);
                return next;
              });
              
              if (currentOperation !== 'delete_certs_batch') {
                setIsOperationInProgress(false);
                setCurrentOperation(null);
                
                setTimeout(() => {
                  setSuccessfulDelete(null);
                  fetchCertificates();
                }, 2000);
              }
            }
            else if (data.operation === 'delete_certs_batch') {
              setDeletingCerts(new Set());
              setSelectedCerts(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
              setSuccessfulDelete(null);
              fetchCertificates();
            }
          }
          
          // Handle operation errors
          if (data.status === 'error') {
            console.error('Operation error:', data.operation, data.message);
            setError(data.message || 'Operation failed');
            if (data.operation === 'download' || data.operation === 'download_batch') {
              setDownloadingCerts(prev => {
                const next = new Set(prev);
                if (data.details?.username) {
                  next.delete(data.details.username);
                }
                return next;
              });
              if (currentOperation !== 'download_batch') {
                setIsOperationInProgress(false);
                setCurrentOperation(null);
              }
            } else {
              setSuccessfulDelete(null);
              setDeletingCerts(new Set());
              setDownloadingCerts(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
            }
          }
          
          if (onOperationProgress) {
            onOperationProgress(data);
          }
        }
      } catch (error) {
        console.error('Error processing SSE event:', error);
        setIsOperationInProgress(false);
        setCurrentOperation(null);
        setSuccessfulDelete(null);
        setDeletingCerts(new Set());
        setDownloadingCerts(new Set());
      }
    });

    eventSource.onerror = () => {
      setTimeout(() => {
        eventSource.close();
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

  const handleDownload = async (username?: string) => {
    try {
      setError(null);
      setCurrentOperation(username ? 'download' : 'download_batch');
      setIsOperationInProgress(true);
      
      // Set initial loading state
      if (username) {
        setDownloadingCerts(new Set([username]));
      } else {
        // For batch downloads, set all selected certs as downloading
        setDownloadingCerts(new Set(selectedCerts));
      }

      // For batch downloads, we'll download each certificate individually
      const certsToDownload = username ? [username] : Array.from(selectedCerts);
      
      for (const cert of certsToDownload) {
        try {
          const response = await fetch('/api/certmanager/certificates/download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              usernames: [cert]
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to download certificate');
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${cert}.p12`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          // Update loading state for this certificate
          setDownloadingCerts(prev => {
            const next = new Set(prev);
            next.delete(cert);
            return next;
          });
        } catch (error) {
          console.error('Error downloading certificate:', cert, error);
          setDownloadingCerts(prev => {
            const next = new Set(prev);
            next.delete(cert);
            return next;
          });
        }
      }
      
      // Only clear operation state after all downloads are complete
      if (!username) {
        setSelectedCerts(new Set());
      }
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      
    } catch (error) {
      console.error('Download operation failed:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      setDownloadingCerts(new Set());
    }
  };

  const handleCreateDataPackages = () => {
    const selectedCertIds = Array.from(selectedCerts);
    const selectedCertificates = certificates
      .filter(cert => selectedCertIds.includes(cert.identifier))
      .map(cert => ({
        identifier: cert.identifier,
        p12Path: `cert/${cert.identifier}.p12`
      }));

    navigate('/data-package?tab=generator', {
      state: {
        selectedCertificates,
        fromCertManager: true
      }
    });
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Existing Certificates</CardTitle>
        <CardDescription>Manage and view your existing TAK certificates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-full">
                <Input
                  type="text"
                  placeholder="Search certificates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={isOperationInProgress}
                className="whitespace-nowrap"
              >
                {selectedCerts.size === filteredCertificates.length && filteredCertificates.length > 0 
                  ? 'Deselect All' 
                  : 'Select All'}
              </Button>
              
              {selectedCerts.size > 0 && (
                <>
                  <Button
                    variant="danger"
                    onClick={handleBatchDeleteClick}
                    disabled={isOperationInProgress}
                    loading={currentOperation === 'delete_certs_batch'}
                    loadingText={`Deleting ${selectedCerts.size} certificates...`}
                    className="whitespace-nowrap"
                  >
                    Delete Selected ({selectedCerts.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload()}
                    disabled={isOperationInProgress}
                    loading={currentOperation === 'download_batch'}
                    loadingText={`Downloading ${selectedCerts.size} certificates...`}
                    className="whitespace-nowrap"
                  >
                    Download Selected ({selectedCerts.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">Error on Operation: {error}</p>
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
                      className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/60 transition-all duration-200 gap-2"
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
                                <div className="flex items-center gap-1 cursor-text">
                                  {cert.passwordHashed ? (
                                    <>
                                      <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">Password Configured</span>
                                    </>
                                  ) : (
                                    <>
                                      <LockKeyholeOpen className="h-4 w-4 text-muted-foreground" />
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
                                '&:hover': {
                                  color: 'hsl(var(--primary))', // Change text color on hover
                                },
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(cert.identifier)}
                                disabled={isOperationInProgress}
                                className="relative hover:text-green-500 dark:hover:text-green-600"
                              >
                                {downloadingCerts.has(cert.identifier) ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <ArrowDownToLine className="h-5 w-5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download .p12 extension</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(cert.identifier)}
                          disabled={isOperationInProgress}
                          className="relative dark:hover:text-red-600 hover:text-red-500"
                        >
                          {(isOperationInProgress && currentOperation === 'delete_certs' && certToDelete === cert.identifier) || 
                           (currentOperation === 'delete_certs_batch' && deletingCerts.has(cert.identifier)) ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : successfulDelete === cert.identifier ? (
                            <Check className="h-5 w-5 text-primary" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="primary"
              onClick={handleCreateDataPackages}
              disabled={isOperationInProgress}
              className="whitespace-nowrap"
            >
              Create Data Packages
            </Button>
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