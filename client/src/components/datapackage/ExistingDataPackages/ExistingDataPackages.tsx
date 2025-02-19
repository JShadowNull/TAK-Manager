import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Check, Loader2, ArrowDownToLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import PackageOperationPopups from './PackageOperationPopups';

interface DataPackage {
  fileName: string;
  createdAt: string;
  size: string;
}

interface ExistingDataPackagesProps {
  onCreateDataPackage?: () => void;
  packages?: DataPackage[];
  onOperationProgress?: (data: any) => void;
  isLoading?: boolean;
}

type Operation = 'delete_package' | 'delete_package_batch' | 'download' | 'download_batch' | null;

const ExistingDataPackages: React.FC<ExistingDataPackagesProps> = ({
  packages: initialPackages = [],
  onOperationProgress,
  isLoading: initialLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [currentOperation, setCurrentOperation] = useState<Operation>(null);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>(initialPackages);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string>();
  const [successfulDelete, setSuccessfulDelete] = useState<string | null>(null);
  const [deletingPackages, setDeletingPackages] = useState<Set<string>>(new Set());
  const [downloadingPackages, setDownloadingPackages] = useState<Set<string>>(new Set());

  // Fetch packages
  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/datapackage/list');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.packages)) {
        setPackages(data.packages);
      } else {
        console.error('Invalid package data received:', data);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError('Failed to fetch packages');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPackages();
  }, []);

  // Setup SSE for package status updates
  useEffect(() => {
    const eventSource = new EventSource('/api/datapackage/status-stream');

    eventSource.addEventListener('package-status', async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle package updates
        if (data.type === 'packages_update' && Array.isArray(data.packages)) {
          setPackages(data.packages);
        }
        
        // Handle operation status
        if (data.type === 'status') {
          // Handle operation start
          if (data.status === 'in_progress') {
            if (data.operation === 'delete_package_batch') {
              setCurrentOperation('delete_package_batch');
              setIsOperationInProgress(true);
            } 
            else if (data.operation === 'delete_package' && data.details?.filename) {
              if (currentOperation === 'delete_package_batch') {
                setDeletingPackages(prev => new Set([...prev, data.details.filename]));
              } else {
                setCurrentOperation('delete_package');
                setIsOperationInProgress(true);
                setDeletingPackages(new Set([data.details.filename]));
              }
            }
            else if (data.operation === 'download_batch') {
              setCurrentOperation('download_batch');
              setIsOperationInProgress(true);
            }
            else if (data.operation === 'download' && data.details?.filename) {
              if (currentOperation === 'download_batch') {
                setDownloadingPackages(prev => new Set([...prev, data.details.filename]));
              } else {
                setCurrentOperation('download');
                setIsOperationInProgress(true);
                setDownloadingPackages(new Set([data.details.filename]));
              }
            }
          }
          
          // Handle operation completion
          if (data.status === 'complete') {
            if (data.operation === 'download_batch') {
              setDownloadingPackages(new Set());
              setSelectedPackages(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
            }
            else if (data.operation === 'delete_package' && data.details?.filename) {
              setSuccessfulDelete(data.details.filename);
              setDeletingPackages(prev => {
                const next = new Set(prev);
                next.delete(data.details.filename);
                return next;
              });
              
              if (currentOperation !== 'delete_package_batch') {
                setIsOperationInProgress(false);
                setCurrentOperation(null);
                
                setTimeout(() => {
                  setSuccessfulDelete(null);
                  fetchPackages();
                }, 2000);
              }
            }
            else if (data.operation === 'delete_package_batch') {
              setDeletingPackages(new Set());
              setSelectedPackages(new Set());
              setIsOperationInProgress(false);
              setCurrentOperation(null);
              setSuccessfulDelete(null);
              fetchPackages();
            }
          }
          
          // Handle operation errors
          if (data.status === 'error') {
            console.error('Operation error:', data.operation, data.message);
            setError(data.message || 'Operation failed');
            if (data.operation === 'download' || data.operation === 'download_batch') {
              setDownloadingPackages(prev => {
                const next = new Set(prev);
                if (data.details?.filename) {
                  next.delete(data.details.filename);
                }
                return next;
              });
              if (currentOperation !== 'download_batch') {
                setIsOperationInProgress(false);
                setCurrentOperation(null);
              }
            } else {
              setSuccessfulDelete(null);
              setDeletingPackages(new Set());
              setDownloadingPackages(new Set());
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
        setDeletingPackages(new Set());
        setDownloadingPackages(new Set());
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
  }, [currentOperation, onOperationProgress]);

  // Filter packages based on search term
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg =>
      pkg.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [packages, searchTerm]);

  // Handle select/unselect all
  const handleSelectAll = () => {
    if (selectedPackages.size === filteredPackages.length) {
      setSelectedPackages(new Set());
    } else {
      setSelectedPackages(new Set(filteredPackages.map(pkg => pkg.fileName)));
    }
  };

  // Handle individual package selection
  const handleSelectPackage = (fileName: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName);
    } else {
      newSelected.add(fileName);
    }
    setSelectedPackages(newSelected);
  };

  const handleOperation = async (operation: Operation, filename?: string) => {
    try {
      setError(null);
      setCurrentOperation(operation);
      setIsOperationInProgress(true);

      if (operation === 'delete_package' || operation === 'delete_package_batch') {
        const response = await fetch('/api/datapackage/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filenames: filename ? [filename] : Array.from(selectedPackages)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to delete package(s)');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Failed to delete package(s)');
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      setSuccessfulDelete(null);
      setDeletingPackages(new Set());
    }
  };

  const handleDeleteClick = (filename: string) => {
    setPackageToDelete(filename);
    setShowSingleDeleteConfirm(true);
  };

  const handleBatchDeleteClick = () => {
    setShowBatchDeleteConfirm(true);
  };

  const handleSingleDeleteConfirm = () => {
    if (packageToDelete) {
      handleOperation('delete_package', packageToDelete);
      setShowSingleDeleteConfirm(false);
    }
  };

  const handleBatchDeleteConfirm = () => {
    handleOperation('delete_package_batch');
    setShowBatchDeleteConfirm(false);
  };

  const handleCloseConfirm = () => {
    setShowSingleDeleteConfirm(false);
    setShowBatchDeleteConfirm(false);
    setPackageToDelete(undefined);
  };

  const handleDownload = async (filename?: string) => {
    try {
      setError(null);
      setCurrentOperation(filename ? 'download' : 'download_batch');
      setIsOperationInProgress(true);
      
      // Set initial loading state
      const packagesToDownload = filename ? [filename] : Array.from(selectedPackages);
      setDownloadingPackages(new Set(packagesToDownload));

      for (const pkg of packagesToDownload) {
        try {
          // Fetch package data first
          const response = await fetch(`/api/datapackage/download/${pkg}`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Download failed');
          }

          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();

          if (window.pywebview) {
            // Pywebview path - show dialog AFTER fetching data
            const filePath = await window.pywebview.api.save_file_dialog(
              pkg,
              [['Data Packages', 'zip'], ['All Files', '*']]
            );

            if (!filePath) {
              setDownloadingPackages(prev => new Set([...prev].filter(f => f !== pkg)));
              continue;
            }

            await window.pywebview.api.write_binary_file(filePath, new Uint8Array(buffer));
          } else {
            // Browser path - create download link
            const url = window.URL.createObjectURL(new Blob([buffer]));
            const link = document.createElement('a');
            link.href = url;
            link.download = pkg;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }

          // Update loading state after successful save/download
          setDownloadingPackages(prev => new Set([...prev].filter(f => f !== pkg)));

        } catch (error) {
          console.error('Error downloading package:', pkg, error);
          setDownloadingPackages(prev => new Set([...prev].filter(f => f !== pkg)));
        }
      }

      // Final cleanup
      if (!filename) {
        setSelectedPackages(new Set());
      }
      setIsOperationInProgress(false);
      setCurrentOperation(null);

    } catch (error) {
      console.error('Download operation failed:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      setDownloadingPackages(new Set());
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Existing Data Packages</CardTitle>
        <CardDescription>Manage and download your existing TAK data packages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-full">
                <Input
                  type="text"
                  placeholder="Search data packages..."
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
                {selectedPackages.size === filteredPackages.length && filteredPackages.length > 0 
                  ? 'Deselect All' 
                  : 'Select All'}
              </Button>
              
              {selectedPackages.size > 0 && (
                <>
                  <Button
                    variant="danger"
                    onClick={handleBatchDeleteClick}
                    disabled={isOperationInProgress}
                    className="whitespace-nowrap"
                  >
                    {currentOperation === 'delete_package_batch' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting {selectedPackages.size} packages...
                      </>
                    ) : (
                      `Delete Selected (${selectedPackages.size})`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload()}
                    disabled={isOperationInProgress}
                    className="whitespace-nowrap"
                  >
                    {currentOperation === 'download_batch' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading {selectedPackages.size} packages...
                      </>
                    ) : (
                      `Download Selected (${selectedPackages.size})`
                    )}
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
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading data packages...
                  </div>
                ) : filteredPackages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    {searchTerm ? 'No matching data packages found' : 'No data packages found'}
                  </div>
                ) : (
                  filteredPackages.map((pkg) => (
                    <div 
                      key={pkg.fileName} 
                      className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/60 transition-all duration-200 gap-2"
                    >
                      <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        <Checkbox
                          checked={selectedPackages.has(pkg.fileName)}
                          onCheckedChange={() => handleSelectPackage(pkg.fileName)}
                          disabled={isOperationInProgress}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{pkg.fileName}</span>
                          <span className="text-sm text-muted-foreground">
                            Created: {new Date(pkg.createdAt).toLocaleString()} • Size: {pkg.size}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(pkg.fileName)}
                                disabled={isOperationInProgress}
                                className="relative hover:text-green-500 dark:hover:text-green-600"
                              >
                                {downloadingPackages.has(pkg.fileName) ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <ArrowDownToLine className="h-5 w-5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download data package</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(pkg.fileName)}
                          disabled={isOperationInProgress}
                          className="relative dark:hover:text-red-600 hover:text-red-500"
                        >
                          {(isOperationInProgress && currentOperation === 'delete_package' && packageToDelete === pkg.fileName) || 
                           (currentOperation === 'delete_package_batch' && deletingPackages.has(pkg.fileName)) ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : successfulDelete === pkg.fileName ? (
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
        </div>
      </CardContent>

      <PackageOperationPopups
        showSingleDeleteConfirm={showSingleDeleteConfirm}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        selectedPackageName={packageToDelete}
        selectedCount={selectedPackages.size}
        onSingleDeleteConfirm={handleSingleDeleteConfirm}
        onBatchDeleteConfirm={handleBatchDeleteConfirm}
        onClose={handleCloseConfirm}
      />
    </Card>
  );
};

export default ExistingDataPackages; 