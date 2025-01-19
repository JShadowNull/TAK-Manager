import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/shadcn/tabs";
import CotStreamsSection from '../components/datapackage/CotStreamsSection/CotStreamsSection';
import AtakPreferencesSection from '../components/datapackage/AtakPreferencesSection/AtakPreferencesSection';
import BulkGeneratorSection from '../components/datapackage/BulkGeneratorSection/PackageGenerator';
import { PreferenceState } from '../components/datapackage/AtakPreferencesSection/atakPreferencesConfig';

interface ValidationErrors {
  cotStreams: Record<string, string>;
  atakPreferences: Record<string, string>;
}

const DataPackage: React.FC = () => {
  // State management
  const [preferences, setPreferences] = useState<Record<string, PreferenceState>>(() => {
    const cotStreams = localStorage.getItem('cotStreamsPreferences');
    const atak = localStorage.getItem('atakPreferences');
    return {
      ...(cotStreams ? JSON.parse(cotStreams) : {}),
      ...(atak ? JSON.parse(atak) : {})
    };
  });

  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('currentTab') || 'cot-streams';
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    cotStreams: {},
    atakPreferences: {}
  });

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('currentTab', currentTab);
  }, [currentTab]);

  // Effect to update localStorage when preferences change
  useEffect(() => {
    const updateStorage = () => {
      const cotStreamsPrefs = Object.entries(preferences).reduce((acc, [key, value]) => {
        if (key.includes('description') || key.includes('ipAddress') || key.includes('port') || 
            key.includes('protocol') || key.includes('count') || key.includes('caLocation') || 
            key.includes('certificateLocation') || key.includes('clientPassword') || 
            key.includes('caPassword')) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, PreferenceState>);

      const atakPrefs = Object.entries(preferences).reduce((acc, [key, value]) => {
        if (!Object.keys(cotStreamsPrefs).includes(key)) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, PreferenceState>);

      if (Object.keys(cotStreamsPrefs).length > 0) {
        localStorage.setItem('cotStreamsPreferences', JSON.stringify(cotStreamsPrefs));
      }
      if (Object.keys(atakPrefs).length > 0) {
        localStorage.setItem('atakPreferences', JSON.stringify(atakPrefs));
      }
    };

    updateStorage();
  }, [preferences]);

  // Effect to handle component unmounting and cleanup
  useEffect(() => {
    let isSubscribed = true;

    // Function to save current state before unmounting
    const saveStateBeforeUnmount = () => {
      if (!isSubscribed) return;

      try {
        // Save the current state to localStorage
        const cotStreamsPrefs = Object.entries(preferences).reduce((acc, [key, value]) => {
          if (key.includes('description') || key.includes('ipAddress') || key.includes('port') || 
              key.includes('protocol') || key.includes('count') || key.includes('caLocation') || 
              key.includes('certificateLocation') || key.includes('clientPassword') || 
              key.includes('caPassword')) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, PreferenceState>);

        const atakPrefs = Object.entries(preferences).reduce((acc, [key, value]) => {
          if (!Object.keys(cotStreamsPrefs).includes(key)) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, PreferenceState>);

        // Only save if we have data to save
        if (Object.keys(cotStreamsPrefs).length > 0) {
          localStorage.setItem('cotStreamsPreferences', JSON.stringify(cotStreamsPrefs));
        }
        if (Object.keys(atakPrefs).length > 0) {
          localStorage.setItem('atakPreferences', JSON.stringify(atakPrefs));
        }
        if (currentTab) {
          sessionStorage.setItem('currentTab', currentTab);
        }
      } catch (error) {
        // Silently handle any errors
      }
    };

    // Add beforeunload event listener
    window.addEventListener('beforeunload', saveStateBeforeUnmount);

    return () => {
      isSubscribed = false;
      window.removeEventListener('beforeunload', saveStateBeforeUnmount);
      
      // Save state one final time on unmount
      saveStateBeforeUnmount();
    };
  }, [preferences, currentTab]);

  // Common handlers for preferences
  const handlePreferenceChange = useCallback((label: string, value: string) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        value
      }
    }));
  }, []);

  const handlePreferenceEnable = useCallback((label: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [label]: {
        ...prev[label],
        enabled
      }
    }));
  }, []);

  const handleValidationChange = useCallback((section: keyof ValidationErrors, errors: Record<string, string>) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev, [section]: errors };
      if (JSON.stringify(prev) === JSON.stringify(newErrors)) {
        return prev;
      }
      return newErrors;
    });
  }, []);

  const validationStatus = useMemo(() => {
    const cotErrors = validationErrors.cotStreams;
    const atakErrors = Object.entries(validationErrors.atakPreferences)
      .filter(([key]) => preferences[key]?.enabled)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return {
      hasErrors: Object.keys(cotErrors).length > 0 || Object.keys(atakErrors).length > 0,
      errors: {
        cotStreams: cotErrors,
        atakPreferences: atakErrors
      }
    };
  }, [validationErrors, preferences]);

  return (
    <div className="bg-background text-foreground pt-4">
      <div className="mx-auto space-y-8">
        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-muted">
              <TabsTrigger 
                value="cot-streams" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Configure TAK Servers
              </TabsTrigger>
              <TabsTrigger 
                value="atak-preferences" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                ATAK Settings
              </TabsTrigger>
              <TabsTrigger 
                value="bulk-generator" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Package Generator
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="cot-streams" className="w-full">
              <div className="bg-background rounded-lg">
                <CotStreamsSection
                  preferences={preferences}
                  onPreferenceChange={handlePreferenceChange}
                  onValidationChange={(errors) => handleValidationChange('cotStreams', errors)}
                />
              </div>
            </TabsContent>
            <TabsContent value="atak-preferences" className="w-full">
              <div className="bg-card rounded-lg">
                <AtakPreferencesSection
                  preferences={preferences}
                  onPreferenceChange={handlePreferenceChange}
                  onEnableChange={handlePreferenceEnable}
                  onValidationChange={(errors) => handleValidationChange('atakPreferences', errors)}
                />
              </div>
            </TabsContent>
            <TabsContent value="bulk-generator" className="w-full">
              <div className="bg-card rounded-lg">
                <BulkGeneratorSection
                  preferences={preferences}
                  onValidationChange={() => {}}
                  disabled={validationStatus.hasErrors}
                  validationErrors={validationStatus.errors}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default DataPackage; 