import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/shared/ui/shadcn/button';
import { Switch } from '@/components/shared/ui/shadcn/switch';
import { Checkbox } from '@/components/shared/ui/shadcn/checkbox';
import { Input } from '@/components/shared/ui/shadcn/input';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/shared/ui/shadcn/card/card';
import { Trash2, UploadCloud, Loader2, FileText } from 'lucide-react';
import { toast } from '@/components/shared/ui/shadcn/toast/use-toast';
import { PreferenceState } from '../AtakPreferencesSection/atakPreferencesConfig';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shared/ui/shadcn/tooltip/tooltip';

interface UploadCustomFilesSectionProps {
  onFilesChange: (files: { customFiles: PreferenceState }) => void;
}

interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
}

const UploadCustomFilesSection: React.FC<UploadCustomFilesSectionProps> = ({ onFilesChange }) => {
  const [files, setFiles] = useState<Record<string, { 
    enabled: boolean;
    metadata: FileMetadata;
  }>>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentOperation, setCurrentOperation] = useState<'upload' | 'delete' | null>(null);

  // Add a ref to track initial mount
  const initialMount = useRef(true);

  const filteredFiles = useMemo(() => {
    return Object.keys(files).filter(fileName =>
      fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [files, searchTerm]);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/datapackage/custom-files');
      const data = await response.json();
      
      if (data.success) {
        // Load saved states from localStorage
        const savedStates = localStorage.getItem('customFilesEnabledStates');
        const enabledStates = savedStates ? JSON.parse(savedStates) : {};
        
        setFiles(prevFiles => {
          const newFiles = data.files.reduce((acc: Record<string, any>, file: FileMetadata) => {
            // Use saved state if available, otherwise use existing state or default to true
            const isEnabled = enabledStates[file.name] !== undefined 
              ? enabledStates[file.name] 
              : prevFiles[file.name]?.enabled ?? true;
            
            acc[file.name] = { 
              enabled: isEnabled,
              metadata: file
            };
            return acc;
          }, {});
          return newFiles;
        });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch files' });
    }
  }, []);

  useEffect(() => {
    if (initialMount.current) {
      fetchFiles();
      initialMount.current = false;
    }
  }, [fetchFiles]); // Only run once on mount

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setPendingFiles(prev => [...prev, ...acceptedFiles]),
    accept: {
      'application/octet-stream': [],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'application/xml': ['.xml'],
      'application/x-yaml': ['.yaml', '.yml'],
      'application/zip': ['.zip'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'application/pdf': ['.pdf']
    },
    maxSize: 5000000000,
    multiple: true
  });

  // Add effect to sync files state with parent
  useEffect(() => {
    const enabledFiles = Object.entries(files)
      .filter(([_, file]) => file.enabled)
      .map(([name]) => name);
    
    console.log('[UploadCustomFilesSection] Syncing files state with parent:', {
      enabledFiles,
      filesState: files
    });

    onFilesChange({
      customFiles: {
        value: JSON.stringify(enabledFiles),
        enabled: enabledFiles.length > 0
      }
    });
  }, [files, onFilesChange]);

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles));
    }
  };

  const handleSelectFile = (fileName: string) => {
    const newSelected = new Set(selectedFiles);
    newSelected.has(fileName) ? newSelected.delete(fileName) : newSelected.add(fileName);
    setSelectedFiles(newSelected);
  };

  const handleDelete = async () => {
    const filesToDelete = Array.from(selectedFiles);
    console.log('[UploadCustomFilesSection] Deleting files:', filesToDelete);
    try {
      setCurrentOperation('delete');

      await Promise.all(filesToDelete.map(async (file) => {
        await fetch(`/api/datapackage/custom-files/${file}`, { method: 'DELETE' });
      }));

      const newFiles = { ...files };
      filesToDelete.forEach(file => delete newFiles[file]);
      setFiles(newFiles);
      setSelectedFiles(new Set());

      // Get array of remaining enabled filenames
      const enabledFiles = Object.entries(newFiles)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name);
      console.log('[UploadCustomFilesSection] Remaining enabled files:', enabledFiles);

      // Send to parent
      onFilesChange({
        customFiles: {
          value: JSON.stringify(enabledFiles),
          enabled: enabledFiles.length > 0
        }
      });
    } catch (error) {
      console.error('[UploadCustomFilesSection] Delete error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete files' });
    } finally {
      setCurrentOperation(null);
    }
  };

  const handleUpload = async () => {
    try {
      setCurrentOperation('upload');
      console.log('[UploadCustomFilesSection] Starting upload of', pendingFiles.length, 'files');
      
      let successCount = 0;
      
      // Upload files one at a time
      for (const file of pendingFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);  // Use 'file' as the field name
          console.log('[UploadCustomFilesSection] Uploading file:', file.name);

          const response = await fetch('/api/datapackage/custom-files', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('[UploadCustomFilesSection] Upload error for file', file.name, ':', errorData);
            throw new Error(errorData.detail || 'Upload failed');
          }

          const result = await response.json();
          console.log('[UploadCustomFilesSection] Upload success for file', file.name, ':', result);
          successCount++;
        } catch (error) {
          console.error('[UploadCustomFilesSection] Error uploading file', file.name, ':', error);
          toast({ 
            variant: 'destructive', 
            title: `Failed to upload ${file.name}`, 
            description: error instanceof Error ? error.message : 'Upload failed' 
          });
        }
      }

      // Clear pending files and refresh the file list
      setPendingFiles([]);
      await fetchFiles();

      // Show final success message
      if (successCount > 0) {
        toast({
          variant: 'success',
          title: 'Upload Complete',
          description: `Successfully uploaded ${successCount} of ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}`
        });
      }
    } catch (error) {
      console.error('[UploadCustomFilesSection] Upload error:', error);
    } finally {
      setCurrentOperation(null);
    }
  };

  const handleToggleFile = (fileName: string, checked: boolean) => {
    console.log('[UploadCustomFilesSection] Before toggle:', {
      fileName,
      checked,
      currentFiles: files
    });

    const newFiles = { ...files, [fileName]: { ...files[fileName], enabled: checked } };
    setFiles(newFiles);
    
    // Save states to localStorage
    const enabledStates = Object.entries(newFiles).reduce((acc, [name, file]) => {
      acc[name] = file.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    
    localStorage.setItem('customFilesEnabledStates', JSON.stringify(enabledStates));
    
    // Get array of enabled filenames
    const enabledFiles = Object.entries(newFiles)
      .filter(([_, file]) => file.enabled)
      .map(([name]) => name);

    console.log('[UploadCustomFilesSection] After toggle:', {
      enabledFiles,
      newFiles
    });
  };

  // Add this helper function to format file sizes
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Add this function to handle individual file removal from pending files
  const removePendingFile = (fileName: string) => {
    setPendingFiles(prev => prev.filter(file => file.name !== fileName));
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Custom Files</CardTitle>
        <CardDescription>Manage files to include in data packages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div {...getRootProps()} className="border-2 border-dashed rounded-lg py-4 pl-4 text-center cursor-pointer">
            <input {...getInputProps()} />
            <div className="space-y-2">
              {pendingFiles.length > 0 ? (
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    <h4 className="font-medium">Files to upload</h4>
                  </div>
                  <ScrollArea className="h-32 pr-4">
                    {pendingFiles.map((file) => (
                      <div 
                        key={file.name} 
                        className="flex items-center gap-1 py-2 text-sm"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="font-medium">{file.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:text-red-500 hover:bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePendingFile(file.name);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              ) : (
                <>
                  <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                  {isDragActive ? (
                    <p className="text-muted-foreground">Drop files here</p>
                  ) : (
                    <p className="text-muted-foreground">Drag files here or click to select</p>
                  )}
                </>
              )}
            </div>
          </div>

          {pendingFiles.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button 
                onClick={handleUpload} 
                disabled={currentOperation === 'upload'}
                loading={currentOperation === 'upload'}
                loadingText="Uploading..."
              >
                {`Upload ${pendingFiles.length} File${pendingFiles.length !== 1 ? 's' : ''}`}
              </Button>
              <Button variant="outline" onClick={() => setPendingFiles([])}>
                Cancel
              </Button>
            </div>
          )}

          {/* Updated Search and Select controls */}
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-full">
                <Input
                  placeholder="Search files..."
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
                disabled={currentOperation !== null}
                className="whitespace-nowrap"
              >
                {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 
                  ? 'Deselect All' 
                  : 'Select All'}
              </Button>
              
              {selectedFiles.size > 0 && (
                <Button
                  variant="danger"
                  onClick={() => handleDelete()}
                  disabled={currentOperation !== null}
                  className="whitespace-nowrap"
                >
                  {currentOperation === 'delete' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    `Delete Selected (${selectedFiles.size})`
                  )}
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-2">
              {filteredFiles.map((fileName) => (
                <div 
                  key={fileName} 
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted/60 transition-all duration-200 gap-2 cursor-pointer"
                  onClick={() => handleSelectFile(fileName)}
                >
                  <div className={`flex items-center ${selectedFiles.has(fileName) ? 'gap-4' : 'gap-0'} flex-1 w-full md:w-auto`}>
                    <div className={`transition-all duration-200 overflow-hidden ${selectedFiles.has(fileName) ? 'w-4 opacity-100' : 'w-0 opacity-0'} flex items-center h-full`}>
                      <Checkbox
                        checked={selectedFiles.has(fileName)}
                        onCheckedChange={() => handleSelectFile(fileName)}
                        disabled={currentOperation !== null}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="flex flex-col gap-1 justify-center">
                      <span className="font-medium">{fileName}</span>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span>{formatFileSize(files[fileName].metadata.size)}</span>
                        <span>•</span>
                        <span>{files[fileName].metadata.type}</span>
                        <span>•</span>
                        <span>
                          {new Date(files[fileName].metadata.lastModified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div 
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Include</span>
                          <div className="relative flex items-center">
                            <Switch
                              checked={files[fileName].enabled}
                              onCheckedChange={(checked) => handleToggleFile(fileName, checked)}
                              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Include in data packages</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadCustomFilesSection; 