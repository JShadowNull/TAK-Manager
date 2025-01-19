import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Input } from "@/components/shared/ui/shadcn/input";
import { Label } from "@/components/shared/ui/shadcn/label";
import { Button } from "@/components/shared/ui/shadcn/button";
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Plus, Minus } from 'lucide-react';
import { generateCotStreamItems } from './cotStreamConfig';
import PreferenceItem from '../shared/PreferenceItem';

const CotStreamsSection = memo(({ 
  preferences, 
  onPreferenceChange
}) => {
  const [certOptions, setCertOptions] = useState([]);
  const count = parseInt(preferences.count?.value || "1", 10);
  const eventSource = useRef(null);
  const configItems = generateCotStreamItems(count);

  // Initialize preferences only when new ones are added
  useEffect(() => {
    const newItems = configItems.filter(item => !preferences[item.label]);
    
    if (newItems.length > 0) {
      newItems.forEach((item) => {
        onPreferenceChange(item.label, '');
      });
    }
  }, [preferences, onPreferenceChange, configItems]);

  // Function to fetch certificates initially
  const fetchCertificates = useCallback(async () => {
    try {
      const response = await fetch('/api/datapackage/certificate-files');
      if (!response.ok) {
        throw new Error(`Failed to fetch certificates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.files) {
        const options = data.files.map(file => ({
          label: file,
          value: `cert/${file}`
        }));
        setCertOptions(options);
      }
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setCertOptions([]); // Ensure we always have an array
    }
  }, []);

  // Set up SSE for certificate monitoring
  useEffect(() => {
    fetchCertificates();
    eventSource.current = new EventSource('/api/datapackage/certificate-stream');
    
    eventSource.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'certificate_list' && Array.isArray(data.certificates)) {
          const options = data.certificates.map(file => ({
            label: file,
            value: `cert/${file}`
          }));
          setCertOptions(options);
        }
      } catch (error) {
        console.error('Error parsing certificate update:', error);
        setCertOptions([]); // Ensure we always have an array
      }
    };

    eventSource.current.onerror = (error) => {
      console.error('SSE connection error:', error);
      setCertOptions([]); // Ensure we always have an array
      setTimeout(() => {
        if (eventSource.current) {
          eventSource.current.close();
          eventSource.current = new EventSource('/api/datapackage/certificate-stream');
        }
      }, 5000);
    };

    return () => {
      if (eventSource.current) {
        eventSource.current.close();
        eventSource.current = null;
      }
    };
  }, [fetchCertificates]);

  const renderStreamConfig = (streamIndex) => {
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
                  onChange={(e) => onPreferenceChange(item.label, e.target.value)}
                  min={item.min}
                  max={item.max}
                  showLabel={true}
                  showEnableToggle={false}
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
          <Label className="text-lg font-medium">Number of Servers</Label>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => {
                const newCount = Math.max(1, parseInt(preferences.count?.value || "1") - 1);
                onPreferenceChange('count', newCount.toString());
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
              onChange={(e) => onPreferenceChange('count', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)).toString())}
              className="w-16 text-center bg-input text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button 
              onClick={() => {
                const newCount = Math.min(10, parseInt(preferences.count?.value || "1") + 1);
                onPreferenceChange('count', newCount.toString());
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