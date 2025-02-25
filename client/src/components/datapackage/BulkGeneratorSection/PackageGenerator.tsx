import React, { useState, useCallback, useEffect } from 'react';
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
import { useLocation } from 'react-router-dom';
import { toast } from "@/components/shared/ui/shadcn/toast/use-toast";
import { HelpIconTooltip } from "@/components/shared/ui/shadcn/tooltip/HelpIconTooltip";

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
  certificates: Array<{
    identifier: string;
    role: string;
    passwordHashed: boolean;
    groups: string[];
  }>;
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
    setTouchedFields(prev => ({ ...prev, [certValue]: true }));
    const errors = validateFileName(bulkFileNames[certValue] || '', certValue);
    setFileNameErrors(prev => ({ ...prev, ...errors }));
    onValidationChange(errors);
  };

  const fetchCertificates = useCallback(async () => {
    try {
      const response = await fetch('/api/certmanager/certificates');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch certificates');
      }
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        const availableCertOptions = data.certificates.map(cert => ({
          label: cert.identifier,
          value: `cert/${cert.identifier}.p12`
        }));
        setAvailableCerts(availableCertOptions);

        if (pendingSelections.length > 0) {
          const certsToSelect = availableCertOptions.filter(cert => 
            pendingSelections.some(pending => pending.p12Path === cert.value)
          );
          setSelectedCerts(certsToSelect);
          const initialFileNames = certsToSelect.reduce((acc, cert) => ({
            ...acc,
            [cert.value]: cert.label
          }), {});
          setBulkFileNames(initialFileNames);
          setPendingSelections([]);
        }
      }
    } catch (error: unknown) {
      setAvailableCerts([]);
      toast({
        variant: "destructive",
        title: "Certificate Error",
        description: error instanceof Error ? error.message : "Failed to load certificates"
      });
    }
  }, [pendingSelections]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const toggleCertificate = (cert: CertOption) => {
    setSelectedCerts(prev => {
      const isSelected = prev.some(selected => selected.value === cert.value);
      const newCerts = isSelected
        ? prev.filter(selected => selected.value !== cert.value)
        : [...prev, cert];
      
      if (!isSelected) {
        setBulkFileNames(prev => ({ ...prev, [cert.value]: cert.label }));
      } else {
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
    setBulkFileNames(prev => ({ ...prev, [certValue]: newName }));
  };

  const handleGenerate = async () => {
    // Get fresh errors from localStorage with correct key
    const storedErrors = JSON.parse(localStorage.getItem('datapackage-validationErrors') || '{}');
    const currentErrors = {
      cotStreams: storedErrors.cotStreams || {},
      atakPreferences: storedErrors.atakPreferences || {}
    };

    // Helper to format field names
    const formatFieldName = (field: string) => {
      const match = field.match(/([a-zA-Z]+)(\d+)/);
      if (match) {
        const [, name, index] = match;
        const fieldMap: Record<string, string> = {
          ipAddress: 'IP Address',
          protocol: 'Protocol',
          port: 'Port',
          description: 'Description',
          caLocation: 'CA Location',
          certPassword: 'Certificate Password'
        };
        return `${fieldMap[name] || name} (Server ${parseInt(index) + 1})`;
      }
      return field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    };

    // Create error display structure
    const errorSections = [
      { 
        name: 'TAK Server Configuration', 
        errors: currentErrors.cotStreams,
        hasErrors: Object.keys(currentErrors.cotStreams).length > 0 
      },
      { 
        name: 'ATAK Settings', 
        errors: currentErrors.atakPreferences,
        hasErrors: Object.keys(currentErrors.atakPreferences).length > 0 
      }
    ];

    if (errorSections.some(section => section.hasErrors) || disabled) {
      toast({
        variant: "destructive",
        title: "Validation Errors",
        description: (
          <div className="space-y-2">
            {errorSections.map((section, idx) => section.hasErrors && (
              <div key={idx}>
                <div className="font-medium">{section.name}:</div>
                <div className="ml-4">
                  {Object.entries(section.errors).map(([field, error], i) => (
                    <div key={i}>• {formatFieldName(field)}: {String(error)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      });
      return;
    }

    setIsLoading(true);

    try {
      let successCount = 0;
      const totalCerts = selectedCerts.length;

      for (const cert of selectedCerts) {
        try {
          const streamCount = parseInt(preferences.count?.value || "1");
          const fullTakServerConfig: Record<string, string> = { count: streamCount.toString() };

          for (let i = 0; i < streamCount; i++) {
            fullTakServerConfig[`description${i}`] = preferences[`description${i}`]?.value || "";
            fullTakServerConfig[`ipAddress${i}`] = preferences[`ipAddress${i}`]?.value || "";
            fullTakServerConfig[`port${i}`] = preferences[`port${i}`]?.value || "";
            fullTakServerConfig[`protocol${i}`] = preferences[`protocol${i}`]?.value || "";
            fullTakServerConfig[`caLocation${i}`] = preferences[`caLocation${i}`]?.value || "";
            fullTakServerConfig[`certPassword${i}`] = preferences[`certPassword${i}`]?.value || "";
          }

          const atakPreferences = Object.entries(preferences).reduce((acc, [key, pref]) => {
            if (pref.enabled && pref.value && 
                !key.startsWith('description') && !key.startsWith('ipAddress') && 
                !key.startsWith('port') && !key.startsWith('protocol') && 
                !key.startsWith('caLocation') && !key.startsWith('certPassword') &&
                !key.startsWith('count') && key !== 'customFiles') {
              acc[key] = pref.value;
            }
            return acc;
          }, {} as Record<string, any>);

          // Get the list of enabled custom files
          let customFiles: string[] = [];
          if (preferences.customFiles?.enabled && preferences.customFiles?.value) {
            try {
              console.log('[PackageGenerator] Raw custom files value:', preferences.customFiles.value);
              customFiles = JSON.parse(preferences.customFiles.value);
              if (!Array.isArray(customFiles)) {
                console.warn('[PackageGenerator] Custom files not an array, resetting to empty array');
                customFiles = [];
              }
              console.log('[PackageGenerator] Parsed custom files:', customFiles);
            } catch (e) {
              console.error('[PackageGenerator] Failed to parse custom files:', e);
            }
          } else {
            console.log('[PackageGenerator] No custom files to process:', {
              enabled: preferences.customFiles?.enabled,
              hasValue: !!preferences.customFiles?.value
            });
          }

          const requestBody = {
            takServerConfig: fullTakServerConfig,
            atakPreferences,
            clientCert: cert.value,
            zipFileName: bulkFileNames[cert.value] || cert.label,
            customFiles
          };
          console.log('[PackageGenerator] Sending request:', requestBody);

          const response = await fetch('/api/datapackage/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate package');
          }

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.message || 'Failed to generate package');
          }

          successCount++;
        } catch (error) {
          toast({
            variant: "destructive",
            title: `Generation Failed for ${cert.label}`,
            description: error instanceof Error ? error.message : 'Failed to generate package'
          });
        }
      }

      if (successCount > 0) {
        toast({
          variant: "success",
          title: "Packages Generated",
          description: `Successfully created ${successCount} of ${totalCerts} package${totalCerts > 1 ? 's' : ''}`
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCerts = availableCerts.filter(cert => 
    cert.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="w-full break-normal">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Data Package Generator
          <HelpIconTooltip
            tooltip="This will create a zip file for each certificate selected. Ensure you configure the TAK server and ATAK settings before generating packages."
            triggerMode="hover"
            side="right"
          />
        </CardTitle>
        <CardDescription>
        Select one or more client certificates to generate data packages for.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <ScrollArea className="w-1/3 min-w-fit rounded-md border">
            <Command>
              <CommandInput 
                placeholder="Search client certificates..." 
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No certificates found.</CommandEmpty>
                <CommandGroup>
                  {filteredCerts.map((cert) => {
                    const isSelected = selectedCerts.some(selected => selected.value === cert.value);
                    return (
                      <CommandItem
                        key={cert.value}
                        onSelect={() => toggleCertificate(cert)}
                        className="cursor-pointer"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                        <span>{cert.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </ScrollArea>
        </div>

        {selectedCerts.length > 0 && (
          <div>
            <Label className="text-lg font-medium flex items-center gap-2">
              Package Names
              <HelpIconTooltip
                tooltip="By default, the file name will be the same as the certificate name. You can customize the file name for each certificate."
                triggerMode="hover"
                side="right"
              />
            </Label>
            <p className="text-sm text-muted-foreground">Customize file names for generated packages.</p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Certificate</TableHead>
                  <TableHead>File Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCerts.map((cert) => (
                  <TableRow key={cert.value}>
                    <TableCell className="font-medium">{cert.label}</TableCell>
                    <TableCell>
                      <Input
                        value={bulkFileNames[cert.value] || ''}
                        onChange={(e) => handleFileNameChange(cert.value, e.target.value)}
                        onBlur={() => handleBlur(cert.value)}
                        className={cn(
                          "w-64",
                          fileNameErrors[cert.value] && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {touchedFields[cert.value] && fileNameErrors[cert.value] && (
                        <p className="text-sm text-destructive mt-1">{fileNameErrors[cert.value]}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={selectedCerts.length === 0 || isLoading}
            loading={isLoading}
            loadingText="Generating..."
          >
            Generate {selectedCerts.length} Package{selectedCerts.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkGeneratorSection; 