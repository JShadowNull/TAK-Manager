import React, { useEffect, memo } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, PREFERENCE_CATEGORIES, validateAtakPreferences } from './atakPreferencesConfig';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";

const AtakPreferencesSection = memo(({ 
  preferences, 
  onPreferenceChange, 
  onEnableChange, 
  onValidationChange 
}) => {
  // Initialize preferences only when new ones are added
  useEffect(() => {
    const newItems = ATAK_PREFERENCES.filter(item => !preferences[item.label]);
    
    if (newItems.length > 0) {
      newItems.forEach((item) => {
        onPreferenceChange(item.label, item.defaultValue || '');
        onEnableChange(item.label, false); // Start disabled by default
      });
    }
  }, [preferences, onPreferenceChange, onEnableChange]);

  // Validate preferences only when enabled preferences change
  useEffect(() => {
    const enabledPreferences = {};
    Object.entries(preferences).forEach(([key, pref]) => {
      if (pref.enabled) {
        enabledPreferences[key] = pref;
      }
    });

    const errors = validateAtakPreferences(enabledPreferences);
    if (onValidationChange) {
      onValidationChange('atak_preferences', errors);
    }
  }, [preferences, onValidationChange]);

  // Group preferences by category
  const preferencesByCategory = ATAK_PREFERENCES.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-200px)] overflow-hidden">
      <ScrollArea className="h-full">
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
                        required={item.required}
                        placeholder={item.placeholder}
                        onChange={(e) => onPreferenceChange(item.label, e.target.value)}
                        onPreferenceEnableChange={(enabled) => onEnableChange(item.label, enabled)}
                        min={item.min}
                        max={item.max}
                        showLabel={true}
                        showEnableToggle={true}
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