import React, { useEffect, memo, useCallback, useState } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, PREFERENCE_CATEGORIES, PreferenceState } from './atakPreferencesConfig';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { atakPreferenceSchema } from '../shared/validationSchemas';
import { Button } from "@/components/shared/ui/shadcn/button";
import { RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { Label } from '@/components/shared/ui/shadcn/label';

interface AtakPreferencesSectionProps {
  preferences: Record<string, PreferenceState>;
  onPreferenceChange: (label: string, value: string) => void;
  onEnableChange: (label: string, enabled: boolean) => void;
  onValidationChange: (errors: Record<string, string>) => void;
}

const AtakPreferencesSection: React.FC<AtakPreferencesSectionProps> = memo(({ 
  preferences, 
  onPreferenceChange, 
  onEnableChange,
  onValidationChange
}) => {
  const [displayErrors, setDisplayErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [rotate, setRotate] = useState(false);

  // Initialize new preferences only when they don't exist
  useEffect(() => {
    const newItems = ATAK_PREFERENCES.filter(item => !preferences[item.label]);
    if (newItems.length > 0) {
      newItems.forEach((item) => {
        onPreferenceChange(item.label, item.defaultValue || '');
        onEnableChange(item.label, false);
      });
    }
  }, [onPreferenceChange, onEnableChange, preferences]);

  // Validate a single field
  const validateField = useCallback((label: string): Record<string, string> => {
    const pref = preferences[label];
    const prefConfig = ATAK_PREFERENCES.find(p => p.label === label);
    
    if (!prefConfig) {
      return {};
    }

    if (!pref?.enabled) {
      return {};
    }

    if (!pref.value.trim()) {
      return { [label]: "Value is required when preference is enabled" };
    }

    try {
      atakPreferenceSchema.parse({
        value: pref.value,
        enabled: pref.enabled,
        input_type: prefConfig.input_type,
        options: prefConfig.options,
        min: prefConfig.min,
        max: prefConfig.max
      });
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { [label]: error.errors[0].message };
      }
      return {};
    }
  }, [preferences]);

  // Validate all fields regardless of interaction
  const validateAll = useCallback(() => {
    const allErrors: Record<string, string> = {};
    
    ATAK_PREFERENCES.forEach(item => {
      const fieldErrors = validateField(item.label);
      Object.assign(allErrors, fieldErrors);
    });

    onValidationChange(allErrors);
    return allErrors;
  }, [validateField, onValidationChange]);

  // Run validation whenever preferences change
  useEffect(() => {
    validateAll();
  }, [preferences, validateAll]);

  // Validate on enable/disable
  const handleEnableChange = useCallback((label: string, enabled: boolean) => {
    onEnableChange(label, enabled);
    if (enabled) {
      const errors = validateField(label);
      setDisplayErrors(prev => ({
        ...prev,
        ...errors
      }));
    } else {
      setDisplayErrors(prev => {
        const { [label]: _, ...rest } = prev;
        return rest;
      });
    }
    validateAll();
  }, [onEnableChange, validateField, validateAll]);

  // Validate on blur
  const handleBlur = useCallback((label: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [label]: true
    }));

    const errors = validateField(label);
    setDisplayErrors(prev => {
      const newErrors = { ...prev };
      if (Object.keys(errors).length > 0) {
        newErrors[label] = errors[label];
      } else {
        delete newErrors[label];
      }
      return newErrors;
    });
  }, [validateField]);

  // Validate on value change
  const handlePreferenceChange = useCallback((label: string, value: string) => {
    onPreferenceChange(label, value);
    if (touchedFields[label]) {
      const errors = validateField(label);
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
    
    ATAK_PREFERENCES.forEach((item) => {
      onPreferenceChange(item.label, item.defaultValue || '');
      onEnableChange(item.label, false);
    });
    
    setDisplayErrors({});
    setTouchedFields({});
    validateAll();

    setTimeout(() => {
      setRotate(false);
    }, 1000);
  }, [onPreferenceChange, onEnableChange, validateAll]);

  // Group preferences by category
  const preferencesByCategory = ATAK_PREFERENCES.reduce<Record<string, typeof ATAK_PREFERENCES>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-200px)] overflow-hidden">
      <div className="bg-background p-4 mb-2">
        <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-md border border-border">
          <Label className="text-lg font-medium">Number of Servers</Label>
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
        <div className="space-y-6 px-4">
          {Object.entries(PREFERENCE_CATEGORIES).map(([categoryKey, categoryName]) => {
            const categoryPreferences = preferencesByCategory[categoryKey] || [];
            if (categoryPreferences.length === 0) return null;

            return (
              <div key={categoryKey} className="bg-card p-4 rounded-lg shadow-lg border border-border">
                <h3 className="text-xl font-semibold text-primary mb-4">{categoryName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryPreferences.map((item) => {
                    const pref = preferences[item.label] || {};
                    const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : false;
                    const fieldValue = pref.value !== undefined ? pref.value : '';

                    return (
                      <PreferenceItem
                        key={item.label}
                        name={item.name}
                        label={item.label}
                        input_type={item.input_type}
                        value={fieldValue}
                        options={item.options || []}
                        isPreferenceEnabled={isPreferenceEnabled}
                        required={true}
                        placeholder={item.placeholder}
                        onChange={(e) => handlePreferenceChange(item.label, e.target.value)}
                        onPreferenceEnableChange={(enabled) => handleEnableChange(item.label, enabled)}
                        onBlur={() => handleBlur(item.label)}
                        min={item.min}
                        max={item.max}
                        showLabel={true}
                        showEnableToggle={true}
                        error={touchedFields[item.label] ? displayErrors[item.label] : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});

AtakPreferencesSection.displayName = 'AtakPreferencesSection';

export default AtakPreferencesSection; 