import React, { useState, useEffect, useCallback, memo} from 'react';
import { Input } from "@/components/shared/ui/shadcn/input";
import { Label } from "@/components/shared/ui/shadcn/label";
import { Button } from "@/components/shared/ui/shadcn/button";
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Plus, Minus, RotateCcw } from 'lucide-react';
import { generateCotStreamItems} from './cotStreamConfig';
import PreferenceItem from '../shared/PreferenceItem';
import { takServerSchema } from '../shared/validationSchemas';
import { z } from 'zod';

interface CertOption {
  label: string;
  value: string;
  text: string;
}

interface PreferenceState {
  value: string;
  enabled?: boolean;
}

interface CotStreamsSectionProps {
  preferences: Record<string, PreferenceState>;
  onPreferenceChange: (label: string, value: string) => void;
  onValidationChange: (errors: Record<string, string>) => void;
}

const CotStreamsSection: React.FC<CotStreamsSectionProps> = memo(({ 
  preferences, 
  onPreferenceChange,
  onValidationChange
}) => {
  const [certOptions, setCertOptions] = useState<CertOption[]>([]);
  const [displayErrors, setDisplayErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [rotate, setRotate] = useState(false);
  const count = parseInt(preferences.count?.value || "1", 10);
  const configItems = generateCotStreamItems(count);

  // Function to fetch certificates
  const fetchCertificates = useCallback(async () => {
    const abortController = new AbortController();
    
    try {
      const response = await fetch('/api/datapackage/certificate-files', {
        signal: abortController.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch certificates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.files) {
        const options = data.files.map((file: string) => ({
          label: file,
          value: `cert/${file}`,
          text: file
        }));
        setCertOptions(options);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setCertOptions([]);
    }

    return () => {
      abortController.abort();
    };
  }, []);

  // Fetch certificates on component mount
  useEffect(() => {
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

  // Initialize new preferences only when count changes
  useEffect(() => {
    const newItems = configItems.filter(item => !preferences[item.label]);
    if (newItems.length > 0) {
      newItems.forEach((item) => {
        onPreferenceChange(item.label, item.value || '');
      });
    }
  }, [count, configItems, onPreferenceChange]);

  // Validate a single field
  const validateField = useCallback((label: string, value: string): Record<string, string> => {
    // Don't validate blank fields for display
    if (!value.trim()) {
      return {};
    }

    // Extract field name without index
    const fieldMatch = label.match(/^([a-zA-Z]+)\d+$/);
    if (!fieldMatch) {
      return {};
    }
    
    const fieldName = fieldMatch[1] as keyof z.infer<typeof takServerSchema>;
    
    // Create a partial data object with just this field
    const partialData: Partial<z.infer<typeof takServerSchema>> = {
      [fieldName]: fieldName === 'port' ? parseInt(value) || 0 : value
    };

    try {
      // Create a partial schema for just this field
      const fieldSchema = {
        [fieldName]: takServerSchema.shape[fieldName]
      };
      const partialSchema = z.object(fieldSchema);
      partialSchema.parse(partialData);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { [label]: error.errors[0].message };
      }
      return {};
    }
  }, []);

  // Validate all fields regardless of interaction
  const validateAll = useCallback(() => {
    const allErrors: Record<string, string> = {};
    
    for (let i = 0; i < count; i++) {
      const streamData = {
        description: preferences[`description${i}`]?.value || "",
        ipAddress: preferences[`ipAddress${i}`]?.value || "",
        port: parseInt(preferences[`port${i}`]?.value || "0"),
        protocol: preferences[`protocol${i}`]?.value || "",
        caLocation: preferences[`caLocation${i}`]?.value || "",
        certPassword: preferences[`certPassword${i}`]?.value || ""
      };

      try {
        takServerSchema.parse(streamData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            const field = err.path[0] as string;
            allErrors[`${field}${i}`] = err.message;
          });
        }
      }
    }

    onValidationChange(allErrors);
    return allErrors;
  }, [count, preferences, onValidationChange]);

  // Run validation whenever preferences change
  useEffect(() => {
    validateAll();
  }, [preferences, validateAll]);

  const handleBlur = useCallback((label: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [label]: true
    }));

    const value = preferences[label]?.value || '';
    const errors = validateField(label, value);
    
    setDisplayErrors(prev => {
      const newErrors = { ...prev };
      if (Object.keys(errors).length > 0) {
        newErrors[label] = errors[label];
      } else {
        delete newErrors[label];
      }
      return newErrors;
    });
  }, [preferences, validateField]);

  const handleInputChange = useCallback((label: string, value: string) => {
    onPreferenceChange(label, value);
    if (touchedFields[label]) {
      const errors = validateField(label, value);
      setDisplayErrors(prev => {
        const newErrors = { ...prev };
        if (Object.keys(errors).length > 0) {
          newErrors[label] = errors[label];
        } else {
          delete newErrors[label];
        }
        return newErrors;
      });
    }
    // Always run full validation for generate button state
    validateAll();
  }, [onPreferenceChange, validateField, touchedFields, validateAll]);

  const handleReset = useCallback(() => {
    setRotate(true);
    
    onPreferenceChange('count', '1');
    configItems.forEach((item) => {
      onPreferenceChange(item.label, item.value || '');
    });
    
    setDisplayErrors({});
    setTouchedFields({});
    validateAll();

    setTimeout(() => {
      setRotate(false);
    }, 1000);
  }, [onPreferenceChange, configItems, validateAll]);

  const renderStreamConfig = (streamIndex: number) => {
    const streamItems = configItems.filter(item => 
      item.label.endsWith(streamIndex.toString())
    );

    return (
      <div key={streamIndex} className="mb-4 p-4 bg-card rounded-lg shadow-lg border border-border">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-primary">TAK Server {streamIndex + 1}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {streamItems.map((item) => {
            const pref = preferences[item.label] || {};
            const fieldValue = pref.value !== undefined ? pref.value : '';

            if (item.label === 'count') return null;

            if (item.isCertificateDropdown) {
              item.options = certOptions;
            }

            return (
              <div key={item.label} className="w-full">
                <PreferenceItem
                  name={item.name}
                  label={item.label}
                  input_type={item.input_type}
                  value={fieldValue}
                  options={item.options || []}
                  isPreferenceEnabled={true}
                  required={item.required}
                  placeholder={item.placeholder}
                  defaultValue={item.defaultValue}
                  onChange={(e) => onPreferenceChange(item.label, e.target.value)}
                  onPreferenceEnableChange={() => {}}
                  onBlur={() => handleBlur(item.label)}
                  min={item.min}
                  max={item.max}
                  showLabel={true}
                  showEnableToggle={false}
                  error={touchedFields[item.label] ? displayErrors[item.label] : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="bg-background p-4 mb-2">
        <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-md border border-border">
          <div className="flex items-center space-x-4">
            <Label className="text-lg font-medium">Number of Servers</Label>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => {
                  const newCount = Math.max(1, parseInt(preferences.count?.value || "1") - 1);
                  handleInputChange('count', newCount.toString());
                }}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={parseInt(preferences.count?.value || "1") <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="stream-count"
                type="number"
                min={1}
                max={10}
                value={parseInt(preferences.count?.value) || 1}
                onChange={(e) => {
                  const newValue = Math.max(1, Math.min(10, parseInt(e.target.value) || 1)).toString();
                  handleInputChange('count', newValue);
                }}
                className="w-16 text-center bg-input text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                hideArrows
              />
              <Button 
                onClick={() => {
                  const newCount = Math.min(10, parseInt(preferences.count?.value || "1") + 1);
                  handleInputChange('count', newCount.toString());
                }}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={parseInt(preferences.count?.value || "1") >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw 
              className="h-4 w-4 transition-transform" 
              style={{
                transform: rotate ? 'rotate(-360deg)' : 'rotate(0deg)',
                transition: 'transform 1s linear'
              }} 
            />
            Reset to Defaults
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100%-80px)]">
        <div className="space-y-4 px-4">
          {Array.from({ length: count }, (_, i) => renderStreamConfig(i))}
        </div>
      </ScrollArea>
    </div>
  );
});

CotStreamsSection.displayName = 'CotStreamsSection';

export default CotStreamsSection; 