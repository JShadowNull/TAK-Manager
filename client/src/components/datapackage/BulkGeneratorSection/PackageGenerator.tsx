import React, { useState, useCallback } from 'react';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Button } from "@/components/shared/ui/shadcn/button";
import { Label } from "@/components/shared/ui/shadcn/label";
import { Input } from "@/components/shared/ui/shadcn/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/shared/ui/shadcn/card/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shared/ui/shadcn/command";
import { Check } from 'lucide-react';
import { bulkGenerationSchema } from '../shared/validationSchemas';
import { z } from 'zod';
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shared/ui/shadcn/table";
import axios from 'axios';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/shadcn/tooltip/tooltip";
import Popups from './PackageGeneratorPopups';
import { useLocation } from 'react-router-dom';

interface CertOption {
  label: string;
  value: string;
}

interface PreferenceState {
  value: string;
  enabled?: boolean;
}

interface ApiResponse {
  success: boolean;
  files: string[];
}

interface SelectedCertificate {
  identifier: string;
  p12Path: string;
}

interface BulkGeneratorSectionProps {
  preferences: Record<string, PreferenceState>;
  onValidationChange: (errors: Record<string, string>) => void;
  disabled?: boolean;
  validationErrors?: {
    cotStreams: Record<string, string>;
    atakPreferences: Record<string, string>;
  };
}

const BulkGeneratorSection: React.FC<BulkGeneratorSectionProps> = ({ 
  preferences,
  onValidationChange,
  disabled = false,
  validationErrors
}) => {
  const location = useLocation();
  const navigationState = location.state as { selectedCertificates?: SelectedCertificate[], fromCertManager?: boolean } | null;
  
  const [selectedCerts, setSelectedCerts] = useState<CertOption[]>([]);
  const [pendingSelections, setPendingSelections] = useState<SelectedCertificate[]>(
    navigationState?.selectedCertificates || []
  );
  const [availableCerts, setAvailableCerts] = useState<CertOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bulkFileNames, setBulkFileNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [fileNameErrors, setFileNameErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [showGenerateProgress, setShowGenerateProgress] = useState(false);

  // Validate a single file name
  const validateFileName = useCallback((value: string, certValue: string): Record<string, string> => {
    try {
      bulkGenerationSchema.shape.fileNames.parse({ [certValue]: value });
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { [certValue]: error.errors[0].message };
      }
      return {};
    }
  }, []);

  const handleBlur = (certValue: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [certValue]: true
    }));
    
    const errors = validateFileName(bulkFileNames[certValue] || '', certValue);
    setFileNameErrors(prev => ({
      ...prev,
      ...errors
    }));
    onValidationChange(errors);
  };

  // Modified certificate fetching to handle pending selections
  const fetchCertificates = useCallback(async () => {
    const abortController = new AbortController();

    try {
      const response = await fetch('/api/datapackage/certificate-files', {
        signal: abortController.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch certificates: ${response.statusText}`);
      }
      const data = await response.json() as ApiResponse;
      if (data.success && data.files) {
        // Filter for only .p12 certificates
        const p12Certs = data.files.filter(file => file.toLowerCase().endsWith('.p12'));
        const availableCertOptions = p12Certs.map(file => ({
          label: file.replace(/\.p12$/i, ""),
          value: `cert/${file}`
        }));
        setAvailableCerts(availableCertOptions);

        // Handle any pending selections from navigation
        if (pendingSelections.length > 0) {
          const certsToSelect = availableCertOptions.filter(cert => 
            pendingSelections.some(pending => pending.p12Path === cert.value)
          );
          
          setSelectedCerts(certsToSelect);
          
          // Set initial file names
          const initialFileNames: Record<string, string> = {};
          certsToSelect.forEach(cert => {
            initialFileNames[cert.value] = cert.label;
          });
          setBulkFileNames(initialFileNames);
          
          // Clear pending selections after applying them
          setPendingSelections([]);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setAvailableCerts([]);
    }

    return () => {
      abortController.abort();
    };
  }, [pendingSelections]);

  React.useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!isSubscribed) return;
      await fetchCertificates();
    };

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [fetchCertificates]);

  const toggleCertificate = (cert: CertOption) => {
    setSelectedCerts(prev => {
      const isSelected = prev.some(selected => selected.value === cert.value);
      const newCerts = isSelected
        ? prev.filter(selected => selected.value !== cert.value)
        : [...prev, cert];
      
      if (!isSelected) {
        setBulkFileNames(prev => ({
          ...prev,
          [cert.value]: cert.label
        }));
      } else {
        // Remove validation state when removing a certificate
        setFileNameErrors(prev => {
          const { [cert.value]: _, ...rest } = prev;
          return rest;
        });
        setTouchedFields(prev => {
          const { [cert.value]: _, ...rest } = prev;
          return rest;
        });
      }
      
      return newCerts;
    });
  };

  const handleFileNameChange = (certValue: string, newName: string) => {
    setBulkFileNames(prev => ({
      ...prev,
      [certValue]: newName
    }));
  };

  const handleGenerate = async () => {
    if (Object.keys(fileNameErrors).length > 0 || disabled) return;

    setIsLoading(true);
    setShowGenerateProgress(true);

    try {
      // Create packages with the clean preferences and new client certs
      for (const cert of selectedCerts) {
        // Build TAK server config for all streams
        const streamCount = parseInt(preferences.count?.value || "1");

        // Clear previous config and rebuild for all streams
        const fullTakServerConfig: Record<string, string> = {
          count: streamCount.toString()
        };

        // Add config for each stream
        for (let i = 0; i < streamCount; i++) {
          fullTakServerConfig[`description${i}`] = preferences[`description${i}`]?.value || "";
          fullTakServerConfig[`ipAddress${i}`] = preferences[`ipAddress${i}`]?.value || "";
          fullTakServerConfig[`port${i}`] = preferences[`port${i}`]?.value || "";
          fullTakServerConfig[`protocol${i}`] = preferences[`protocol${i}`]?.value || "";
          fullTakServerConfig[`caLocation${i}`] = preferences[`caLocation${i}`]?.value || "";
          fullTakServerConfig[`certPassword${i}`] = preferences[`certPassword${i}`]?.value || "";
        }

        const atakPreferences: Record<string, any> = {};
        for (const [key, pref] of Object.entries(preferences)) {
          if (pref.enabled && pref.value && 
              !key.startsWith('description') && !key.startsWith('ipAddress') && 
              !key.startsWith('port') && !key.startsWith('protocol') && 
              !key.startsWith('caLocation') && !key.startsWith('certPassword') &&
              !key.startsWith('count')) {
            atakPreferences[key] = pref.value;
          }
        }

        const requestData = {
          takServerConfig: fullTakServerConfig,
          atakPreferences,
          clientCert: cert.value,
          zipFileName: bulkFileNames[cert.value] || cert.label
        };

        await axios.post('/api/datapackage/generate', requestData);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateComplete = () => {
    setShowGenerateProgress(false);
  };

  const filteredCerts = availableCerts.filter(cert => 
    cert.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card className="w-full break-normal">
        <CardHeader>
          <CardTitle>Data Package Generator</CardTitle>
          <CardDescription>By default this will use current TAK server settings and ATAK settings so ensure you have configured these before generating packages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-lg font-medium">Select Client Certificates</Label>
            <p className="text-sm text-muted-foreground">Select one or more client certificates to generate data packages for.</p>
            <ScrollArea className="w-1/3 min-w-fit rounded-md border">
              <Command>
                <CommandInput 
                  placeholder="Search client certificates..." 
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No client certificates found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCerts.map((cert) => (
                      <CommandItem
                        key={cert.value}
                        onSelect={() => toggleCertificate(cert)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="flex items-center justify-center w-4 h-4">
                          {selectedCerts.some(selected => selected.value === cert.value) && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>
                        <span>{cert.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </ScrollArea>
          </div>

          {selectedCerts.length > 0 && (
            <div className="space-y-4">
              <Label className="text-lg font-medium">Customize File Names</Label>
              <p className="text-sm text-muted-foreground">Optionally customize the file names for the selected client certificates. By default the file name will be the client certificate name.</p>
              <ScrollArea className="h-72 w-1/3 min-w-fit rounded-lg border p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>File Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCerts.map((cert) => (
                      <TableRow key={cert.value}>
                        <TableCell>
                          <Label htmlFor={`file-name-${cert.value}`} className="text-sm font-medium">
                            {cert.label}
                          </Label>
                        </TableCell>
                        <TableCell>
                          <Input
                            id={`file-name-${cert.value}`}
                            type="text"
                            value={bulkFileNames[cert.value] || cert.label}
                            onChange={(e) => handleFileNameChange(cert.value, e.target.value)}
                            onBlur={() => handleBlur(cert.value)}
                            placeholder={cert.label}
                            className={cn(
                              "w-full",
                              touchedFields[cert.value] && fileNameErrors[cert.value] && "border-red-500"
                            )}
                          />
                          {touchedFields[cert.value] && fileNameErrors[cert.value] && (
                            <p className="text-sm text-red-500">{fileNameErrors[cert.value]}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={handleGenerate}
                      disabled={disabled || selectedCerts.length === 0 || isLoading || Object.keys(fileNameErrors).length > 0}
                      variant="primary"
                      className="w-full sm:w-auto"
                    >
                      Generate {selectedCerts.length} Data Package{selectedCerts.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </TooltipTrigger>
                {(disabled || selectedCerts.length === 0 || Object.keys(fileNameErrors).length > 0) && (
                  <TooltipContent className="max-w-[300px]">
                    <div className="space-y-2">
                      {validationErrors && Object.keys(validationErrors.cotStreams).length > 0 && (
                        <div>
                          <p className="font-semibold">TAK Server Configuration Errors:</p>
                          <ul className="list-disc pl-4">
                            {Object.entries(validationErrors.cotStreams).map(([field, error]) => (
                              <li key={field} className="text-sm">{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validationErrors && Object.keys(validationErrors.atakPreferences).length > 0 && (
                        <div>
                          <p className="font-semibold">ATAK Settings Errors:</p>
                          <ul className="list-disc pl-4">
                            {Object.entries(validationErrors.atakPreferences).map(([field, error]) => (
                              <li key={field} className="text-sm">{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Object.keys(fileNameErrors).length > 0 && (
                        <div>
                          <p className="font-semibold">File Name Errors:</p>
                          <ul className="list-disc pl-4">
                            {Object.entries(fileNameErrors).map(([field, error]) => (
                              <li key={field} className="text-sm">{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedCerts.length === 0 && (
                        <div>
                          <p className="font-semibold">Certificate Selection:</p>
                          <p className="text-sm">Please select at least one certificate.</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <Popups
        onGenerateComplete={handleGenerateComplete}
        showGenerateProgress={showGenerateProgress}
      />
    </>
  );
};

export default BulkGeneratorSection; 