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
import CertificateConfigEditor from './CertificateConfigEditor';
import { toast } from "../shared/ui/shadcn/toast/use-toast";

interface Certificate {
  identifier: string;
  role: string;
  passwordHashed: boolean;
  groups: string[];
}

interface ExistingCertificatesProps {
  onCreateDataPackage: () => void;
  certificates: Certificate[];
  isLoading?: boolean;
}

type Operation = 'delete_certs' | 'delete_certs_batch' | 'download' | 'download_batch' | null;

const ExistingCertificates: React.FC<ExistingCertificatesProps> = ({
  certificates: initialCertificates = [],
  isLoading: initialLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCerts, setSelectedCerts] = useState<Set<string>>(new Set());
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>(initialCertificates);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [certToDelete, setCertToDelete] = useState<string>();
  const [deletingCerts, setDeletingCerts] = useState<Set<string>>(new Set());
  const [downloadingCerts, setDownloadingCerts] = useState<Set<string>>(new Set());
  const [selectedCertForEdit, setSelectedCertForEdit] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<{ [key: string]: boolean }>({});
  const [deleteSelectedSuccess, setDeleteSelectedSuccess] = useState(false);
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
        toast({
          variant: "destructive",
          title: "Error",
          description: data.detail || 'Invalid certificate data received',
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch certificates',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCertificates();
  }, []);

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
      const firstCertId = filteredCertificates[0]?.identifier;
      const certsToDelete = username ? [username] : Array.from(selectedCerts);

      if (certsToDelete.includes(firstCertId)) {
        throw new Error(`Failed to delete primary admin user ${firstCertId}.`);
      }

      setCurrentOperation(operation);
      setIsOperationInProgress(true);

      // For batch operations, set the loading state for each certificate
      if (operation === 'delete_certs_batch') {
        setDeletingCerts(new Set(selectedCerts));
      }

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

      // Set operation in progress to false if successful
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      
      // Handle delete success state
      if (operation === 'delete_certs') {
        setDeleteSuccess(prev => ({ ...prev, [username!]: true }));
        setTimeout(() => {
          setDeleteSuccess(prev => ({ ...prev, [username!]: false }));
        }, 1000);

        // Remove the deleted cert from selectedCerts
        setSelectedCerts(prev => {
          const newSelectedCerts = new Set(prev);
          newSelectedCerts.delete(username!);
          return newSelectedCerts;
        });
      } else if (operation === 'delete_certs_batch') {
        selectedCerts.forEach(certId => {
          setDeleteSuccess(prev => ({ ...prev, [certId]: true }));
          setTimeout(() => {
            setDeleteSuccess(prev => ({ ...prev, [certId]: false }));
          }, 1000);
        });
        
        // Set success for the "Delete Selected" button
        setDeleteSelectedSuccess(true);
        setTimeout(() => {
          setDeleteSelectedSuccess(false);
        }, 1000);

        // Delay clearing selected certs until after the success state is shown
        setTimeout(() => {
          setSelectedCerts(new Set());
        }, 1000);
      }

      setTimeout(() => {
        fetchCertificates();
      }, 1000);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Operation failed',
      });
      setIsOperationInProgress(false);
      setCurrentOperation(null);
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
      setCurrentOperation(username ? 'download' : 'download_batch');
      setIsOperationInProgress(true);
      
      const certsToDownload = username ? [username] : Array.from(selectedCerts);
      setDownloadingCerts(new Set(certsToDownload));

      for (const cert of certsToDownload) {
        try {
          // Fetch certificate data first
          const response = await fetch('/api/certmanager/certificates/download', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({usernames: [cert]})
          });

          if (!response.ok) {
            throw new Error(await response.text());
          }

          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();

          if (window.pywebview) {
            // Pywebview path - show dialog AFTER fetching data
            const filePath = await window.pywebview.api.save_file_dialog(
              `${cert}.p12`,
              [['PKCS12 Files', 'p12'], ['All Files', '*']]
            );

            if (!filePath) {
              // User cancelled - update loading state
              setDownloadingCerts(prev => new Set([...prev].filter(c => c !== cert)));
              continue;
            }

            // Write file and THEN update state
            await window.pywebview.api.write_binary_file(filePath, new Uint8Array(buffer));
          } else {
            // Browser path - create download link
            const url = window.URL.createObjectURL(new Blob([buffer]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `${cert}.p12`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }

          // Only remove from loading state after successful save/download
          setDownloadingCerts(prev => new Set([...prev].filter(c => c !== cert)));

        } catch (error) {
          console.error(`Download failed for ${cert}:`, error);
          setDownloadingCerts(prev => new Set([...prev].filter(c => c !== cert)));
        }
      }

      // Final cleanup
      if (!username) setSelectedCerts(new Set());
      setIsOperationInProgress(false);
      setCurrentOperation(null);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Download failed',
      });
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

  const handleCertificateClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const identifier = (e.currentTarget as HTMLDivElement).dataset.identifier;
    if (identifier) {
      setSelectedCertForEdit(identifier);
    }
  };

  const handleConfigSave = () => {
    // Refresh certificates list after config save
    fetchCertificates();
  };

  return (
    <>
      <Card className="w-full max-w-6xl mx-auto break-normal">
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
                      disabled={isOperationInProgress || selectedCerts.size === 0}
                      loading={currentOperation === 'delete_certs_batch'}
                      loadingText={`Deleting ${selectedCerts.size} certificates...`}
                      className="whitespace-nowrap"
                    >
                      {deleteSelectedSuccess ? (
                        <span className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-primary"/> 
                          {` Deleted ${selectedCerts.size} certificates`}
                        </span>
                      ) : (
                        `Delete Selected (${selectedCerts.size})`
                      )}
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
                        className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/60 transition-all duration-200 gap-2 cursor-pointer"
                        onClick={handleCertificateClick}
                        data-identifier={cert.identifier}
                      >
                        <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                          <Checkbox
                            checked={selectedCerts.has(cert.identifier)}
                            onCheckedChange={() => {
                              handleSelectCert(cert.identifier);
                            }}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                            }}
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
                                  <div className="flex items-center gap-1">
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
                                    color: 'hsl(var(--primary))',
                                  },
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            tooltip="Download .p12 extension"
                            triggerMode="hover"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              handleDownload(cert.identifier);
                            }}
                            disabled={isOperationInProgress}
                            className="relative hover:text-green-600 dark:hover:text-green-500 hover:bg-transparent"
                          >
                            {downloadingCerts.has(cert.identifier) ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <ArrowDownToLine className="h-5 w-5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              handleDeleteClick(cert.identifier);
                            }}
                            tooltip="Delete Certificate Files"
                            triggerMode="hover"
                            disabled={isOperationInProgress || cert.identifier === filteredCertificates[0]?.identifier}
                            className="relative dark:hover:text-red-500 hover:text-red-600 hover:bg-transparent"
                          >
                            {(isOperationInProgress && currentOperation === 'delete_certs' && certToDelete === cert.identifier) || 
                             (currentOperation === 'delete_certs_batch' && deletingCerts.has(cert.identifier)) ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : deleteSuccess[cert.identifier] ? (
                              <Check className="h-5 w-5 text-green-500 dark:text-green-600" />
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

            <div className="flex justify-center lg:justify-end pt-4">
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
      </Card>

      <CertificateConfigEditor
        identifier={selectedCertForEdit || ''}
        isOpen={!!selectedCertForEdit}
        onClose={() => setSelectedCertForEdit(null)}
        onSave={handleConfigSave}
      />

      <CertificateOperationPopups
        showSingleDeleteConfirm={showSingleDeleteConfirm}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        selectedCertName={certToDelete}
        selectedCount={selectedCerts.size}
        onSingleDeleteConfirm={handleSingleDeleteConfirm}
        onBatchDeleteConfirm={handleBatchDeleteConfirm}
        onClose={handleCloseConfirm}
      />
    </>
  );
};

export default ExistingCertificates; 