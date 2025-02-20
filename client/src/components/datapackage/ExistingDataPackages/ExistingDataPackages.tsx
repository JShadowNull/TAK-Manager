import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Input } from '@/components/shared/ui/shadcn/input';
import { Check, Loader2, ArrowDownToLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shared/ui/shadcn/tooltip/tooltip";
import PackageOperationPopups from './PackageOperationPopups';
import { toast } from "@/components/shared/ui/shadcn/toast/use-toast";

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


const ExistingDataPackages: React.FC<ExistingDataPackagesProps> = ({
  packages: initialPackages = [],
  isLoading: initialLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [packages, setPackages] = useState<DataPackage[]>(initialPackages);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string>();
  const [deleteSuccess, setDeleteSuccess] = useState<{ [key: string]: boolean }>({});
  const [deleteSelectedSuccess, setDeleteSelectedSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<{ [key: string]: boolean }>({});
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
        toast({
          title: "Error",
          description: 'Failed to load packages',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: 'Failed to fetch packages',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPackages();
  }, []);

  const handleDelete = async (filename?: string) => {
    try {
      const packagesToDelete = filename ? [filename] : Array.from(selectedPackages);
      setDeletingPackages(new Set(packagesToDelete));

      let response;
      if (packagesToDelete.length > 1) {
        response = await fetch('/api/datapackage/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: packagesToDelete })
        });
      } else {
        const targetFile = packagesToDelete[0];
        response = await fetch(`/api/datapackage/delete/${targetFile}`, {
          method: 'DELETE'
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }

      // Show success toast
      toast({
        title: "Deletion Successful",
        description: packagesToDelete.length > 1 
          ? `Deleted ${packagesToDelete.length} packages`
          : `Deleted ${packagesToDelete[0]}`,
        variant: "success"
      });

      // Update success states FIRST
      packagesToDelete.forEach(pkg => {
        setDeleteSuccess(prev => ({ ...prev, [pkg]: true }));
        setTimeout(() => {
          setDeleteSuccess(prev => ({ ...prev, [pkg]: false }));
        }, 1000);
      });

      if (packagesToDelete.length > 1) {
        setDeleteSelectedSuccess(true);
        setTimeout(() => setDeleteSelectedSuccess(false), 1000);
        
        // Delay clearing selections until after animation
        setTimeout(() => {
          setSelectedPackages(new Set());
        }, 1000);
      }

      // Delay refresh until after success indicators show
      setTimeout(() => {
        fetchPackages();
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete operation failed';
      
      // Show error toast
      toast({
        title: "Deletion Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setDeletingPackages(new Set());
      setShowSingleDeleteConfirm(false);
      setShowBatchDeleteConfirm(false);
    }
  };

  const handleDownload = async (filename?: string) => {
    try {
      const packagesToDownload = filename ? [filename] : Array.from(selectedPackages);
      setDownloadingPackages(new Set(packagesToDownload));

      let successCount = 0;
      for (const pkg of packagesToDownload) {
        try {
          const response = await fetch(`/api/datapackage/download/${pkg}`);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Download failed');
          }

          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();

          if (window.pywebview) {
            const filePath = await window.pywebview.api.save_file_dialog(
              pkg,
              [['Data Packages', 'zip'], ['All Files', '*']]
            );

            if (filePath) {
              await window.pywebview.api.write_binary_file(filePath, new Uint8Array(buffer));
              successCount++;
              setDownloadSuccess(prev => ({ ...prev, [pkg]: true }));
              setTimeout(() => {
                setDownloadSuccess(prev => ({ ...prev, [pkg]: false }));
              }, 1000);
            }
          } else {
            const url = window.URL.createObjectURL(new Blob([buffer]));
            const link = document.createElement('a');
            link.href = url;
            link.download = pkg;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            successCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : `Failed to download ${pkg}`;
          toast({
            title: "Download Error",
            description: errorMessage,
            variant: "destructive"
          });
        } finally {
          setDownloadingPackages(prev => {
            const next = new Set(prev);
            next.delete(pkg);
            return next;
          });
        }
      }

      // Show success toast if any downloads succeeded
      if (successCount > 0) {
        toast({
          title: "Download Complete",
          description: `Successfully downloaded ${successCount} package${successCount > 1 ? 's' : ''}`,
          variant: "success"
        });
      }

      setSelectedPackages(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download operation failed';
      toast({
        title: "Download Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

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

  const handleDeleteClick = (filename: string) => {
    setPackageToDelete(filename);
    setShowSingleDeleteConfirm(true);
  };

  const handleBatchDeleteClick = () => {
    setShowBatchDeleteConfirm(true);
  };

  const handleSingleDeleteConfirm = () => {
    if (packageToDelete) {
      handleDelete(packageToDelete);
      setShowSingleDeleteConfirm(false);
    }
  };

  const handleBatchDeleteConfirm = () => {
    handleDelete();
    setShowBatchDeleteConfirm(false);
  };

  const handleCloseConfirm = () => {
    setShowSingleDeleteConfirm(false);
    setShowBatchDeleteConfirm(false);
    setPackageToDelete(undefined);
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
                disabled={isLoading}
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
                    disabled={isLoading || selectedPackages.size === 0}
                    loading={deletingPackages.size > 0}
                    loadingText={`Deleting ${deletingPackages.size} packages...`}
                    className="whitespace-nowrap"
                  >
                    {deleteSelectedSuccess ? (
                      <span className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary"/> 
                        {`Deleted ${selectedPackages.size} packages`}
                      </span>
                    ) : (
                      `Delete Selected (${selectedPackages.size})`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload()}
                    disabled={isLoading}
                    loading={downloadingPackages.size > 0}
                    loadingText={`Downloading ${downloadingPackages.size} packages...`}
                    className="whitespace-nowrap"
                  >
                    Download Selected ({selectedPackages.size})
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
                      className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/60 transition-all duration-200 gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        <Checkbox
                          checked={selectedPackages.has(pkg.fileName)}
                          onCheckedChange={() => handleSelectPackage(pkg.fileName)}
                          disabled={isLoading}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                        <div className="flex flex-col gap-1">
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
                                disabled={isLoading}
                                className="relative hover:text-green-600 dark:hover:text-green-500 hover:bg-transparent"
                              >
                                {downloadSuccess[pkg.fileName] ? (
                                  <Check className="h-5 w-5 text-green-500 dark:text-green-600" />
                                ) : downloadingPackages.has(pkg.fileName) ? (
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
                          disabled={isLoading}
                          className="relative dark:hover:text-red-500 hover:text-red-600 hover:bg-transparent"
                        >
                          {(deletingPackages.has(pkg.fileName)) ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : deleteSuccess[pkg.fileName] ? (
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