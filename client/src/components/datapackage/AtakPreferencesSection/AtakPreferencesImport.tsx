import React, { useCallback, useState, useEffect } from 'react';
import { Upload, UploadCloud } from 'lucide-react';
import { Button } from "@/components/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { AtakPreference, PreferenceState, parseAtakPreferencesXml, importAtakPreferences } from './atakPreferencesConfig';
import { toast } from "@/components/shared/ui/shadcn/toast/use-toast";
import { useDropzone } from 'react-dropzone';

interface AtakPreferencesImportProps {
  showImportDialog: boolean;
  onShowImportDialogChange: (open: boolean) => void;
  preferences: Record<string, PreferenceState>;
  customPreferences: AtakPreference[];
  allPreferences: AtakPreference[];
  onPreferenceChange: (label: string, value: string) => void;
  onEnableChange: (label: string, enabled: boolean) => void;
  onCustomPreferencesChange: (preferences: AtakPreference[]) => void;
}

export const AtakPreferencesImport: React.FC<AtakPreferencesImportProps> = ({
  showImportDialog,
  onShowImportDialogChange,
  preferences,
  customPreferences,
  allPreferences,
  onPreferenceChange,
  onEnableChange,
  onCustomPreferencesChange
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File | null) => {
    if (!file) {
      setError("No file selected");
      return;
    }

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target?.result as string;
        const parsedPreferences = parseAtakPreferencesXml(xmlContent);
        
        // Filter out empty values
        const filteredPreferences: Record<string, string> = {};
        let skippedCount = 0;
        
        Object.entries(parsedPreferences).forEach(([key, value]) => {
          // Skip preferences with empty values
          if (value && value.trim() !== '') {
            filteredPreferences[key] = value;
          } else {
            skippedCount++;
          }
        });
        
        // Import the preferences
        const { updatedPreferences, newCustomPreferences } = importAtakPreferences(
          filteredPreferences,
          preferences,
          allPreferences
        );
        
        // Update all preferences
        Object.entries(updatedPreferences).forEach(([label, state]) => {
          if (preferences[label]?.value !== state.value || preferences[label]?.enabled !== state.enabled) {
            onPreferenceChange(label, state.value);
            onEnableChange(label, state.enabled);
          }
        });
        
        // Add new custom preferences
        if (newCustomPreferences.length > 0) {
          const updatedCustomPrefs = [...customPreferences, ...newCustomPreferences];
          onCustomPreferencesChange(updatedCustomPrefs);
        }
        
        const successMessage = skippedCount > 0 
          ? `Successfully imported ${Object.keys(filteredPreferences).length} preferences. Added ${newCustomPreferences.length} new custom settings. Skipped ${skippedCount} empty values.`
          : `Successfully imported ${Object.keys(filteredPreferences).length} preferences. Added ${newCustomPreferences.length} new custom settings.`;
        
        toast({
          title: "Import Successful",
          description: successMessage,
          variant: "success",
        });
        
        // Close the dialog after successful import
        setTimeout(() => {
          onShowImportDialogChange(false);
          setSelectedFile(null);
          setIsUploading(false);
        }, 1500);
      } catch (error) {
        console.error("Error importing preferences:", error);
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Failed to import preferences",
          variant: "destructive",
        });
        setIsUploading(false);
        setError(error instanceof Error ? error.message : "Failed to import preferences");
      }
    };
    
    reader.onerror = () => {
      toast({
        title: "Import Failed",
        description: "Error reading the file",
        variant: "destructive",
      });
      setIsUploading(false);
      setError("Error reading the file");
    };
    
    reader.readAsText(file);
  }, [allPreferences, customPreferences, onCustomPreferencesChange, onEnableChange, onPreferenceChange, onShowImportDialogChange, preferences]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.pref'],
      'text/xml': ['.pref', '.xml'],
    },
    maxFiles: 1,
  });

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
    // Reset the file input
    event.target.value = '';
  };

  // For native file drop support
  useEffect(() => {
    if (typeof window.handleNativeFileDrop === 'function') {
      const originalHandler = window.handleNativeFileDrop;
      
      window.handleNativeFileDrop = (fullPath: string) => {
        if (showImportDialog && (fullPath.endsWith('.pref') || fullPath.endsWith('.xml'))) {
          const file = new File([fullPath], fullPath.split('/').pop() || 'preferences.pref', {
            type: 'application/octet-stream',
            lastModified: Date.now()
          });
          setSelectedFile(file);
          setError(null);
        } else {
          originalHandler(fullPath);
        }
      };
      
      return () => {
        window.handleNativeFileDrop = originalHandler;
      };
    }
  }, [showImportDialog]);

  const handleUpload = () => {
    processFile(selectedFile);
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => onShowImportDialogChange(true)}
      >
        <Upload size={16} />
        <span className="sr-only lg:not-sr-only lg:whitespace-nowrap">
          Import Preferences
        </span>
      </Button>

      <Dialog open={showImportDialog} onOpenChange={onShowImportDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import ATAK Preferences</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an ATAK preferences file to import settings. Any preferences in the file that match existing settings will be updated. New preferences will be added as custom settings. Empty values will be skipped.
            </p>
            
            <div {...getRootProps()} className={`flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:bg-muted/30'}
              ${error ? 'border-red-500' : ''}`}>
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive ? (
                    "Drop the preferences file here"
                  ) : selectedFile ? (
                    <span className="text-primary">{selectedFile.name}</span>
                  ) : (
                    "Drag and drop your ATAK preferences file here, or click to select"
                  )}
                </p>
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                <input 
                  {...getInputProps()}
                  type="file" 
                  className="hidden" 
                  accept=".pref,.xml"
                  onChange={handleFileInputChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => onShowImportDialogChange(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              loading={isUploading}
              loadingText="Importing..."
            >
              Upload and Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 