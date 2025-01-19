import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Button } from "@/components/shared/ui/shadcn/button";
import { Label } from "@/components/shared/ui/shadcn/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shared/ui/shadcn/command";
import { Check } from 'lucide-react';

const BulkGeneratorSection = ({ 
  preferences,
  onGeneratePackages,
  disabled = false 
}) => {
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [availableCerts, setAvailableCerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available client certificates
  const fetchCertificates = useCallback(async () => {
    try {
      const response = await fetch('/api/datapackage/certificate-files');
      if (!response.ok) {
        throw new Error(`Failed to fetch certificates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.files) {
        // Filter for only .p12 certificates
        const p12Certs = data.files.filter(file => file.toLowerCase().endsWith('.p12'));
        setAvailableCerts(p12Certs.map(file => ({
          label: file.replace(/\.p12$/i, ""), // Remove .p12 extension
          value: `cert/${file}`
        })));
      }
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setAvailableCerts([]);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const toggleCertificate = (cert) => {
    setSelectedCerts(prev => {
      const isSelected = prev.some(selected => selected.value === cert.value);
      if (isSelected) {
        return prev.filter(selected => selected.value !== cert.value);
      } else {
        return [...prev, cert];
      }
    });
  };

  const handleGenerate = () => {
    if (selectedCerts.length === 0) return;

    // Create a clean copy of preferences without any client certificate
    const basePreferences = { ...preferences };
    delete basePreferences.certificateLocation0;

    // Create packages with the clean preferences and new client certs
    const packages = selectedCerts.map(cert => ({
      ...basePreferences,
      certificateLocation0: cert.value,
      zipName: cert.label
    }));

    onGeneratePackages(packages);
  };

  return (
    <div className="h-[calc(100vh-200px)] overflow-hidden">
      <div className="bg-background p-4">
        <div className="bg-card p-4 rounded-lg shadow-lg border border-border">
          <div className="space-y-4">
            <div>
              <Label className="text-lg font-medium">Selected Client Certificates ({selectedCerts.length})</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Select the client certificates (.p12) to generate packages for. Each package will use the current TAK Server and ATAK settings configuration.
              </p>
            </div>

            <ScrollArea className="h-[400px] w-full rounded-md border">
              <Command>
                <CommandInput placeholder="Search client certificates..." />
                <CommandList>
                  <CommandEmpty>No client certificates found.</CommandEmpty>
                  <CommandGroup>
                    {availableCerts.map((cert) => (
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

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={disabled || selectedCerts.length === 0 || isLoading}
                variant="primary"
              >
                Generate {selectedCerts.length} Data Package{selectedCerts.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkGeneratorSection; 