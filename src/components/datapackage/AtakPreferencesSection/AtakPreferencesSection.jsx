import React, { useEffect, memo } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, validateAtakPreferences } from './atakPreferencesConfig';

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
        onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        onEnableChange(item.label, true);
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

  const handleSelectAll = () => {
    ATAK_PREFERENCES.forEach((item) => {
      onEnableChange(item.label, true);
    });
  };

  const handleUnselectAll = () => {
    ATAK_PREFERENCES.forEach((item) => {
      onEnableChange(item.label, false);
    });
  };

  return (
    <div className="p-4 bg-backgroundPrimary">
      <button 
        className="hidden atak-prefs-select-all"
        onClick={handleSelectAll}
      />
      <button 
        className="hidden atak-prefs-unselect-all"
        onClick={handleUnselectAll}
      />

      <div className="divide-y divide-border">
        {ATAK_PREFERENCES.map((item) => {
          const pref = preferences[item.label] || {};
          
          // Always default to enabled unless explicitly disabled
          const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : true;
          
          // Get the current value, using preference value if available
          const fieldValue = pref.value !== undefined ? pref.value : item.value;
          
          return (
            <div key={item.label} className="py-2 first:pt-0 last:pb-0">
              <PreferenceItem
                name={item.name}
                label={item.label}
                input_type={item.input_type}
                value={fieldValue}
                checked={item.input_type === 'checkbox' ? pref.value : undefined}
                options={item.options || []}
                isPreferenceEnabled={isPreferenceEnabled}
                required={item.required}
                placeholder={item.placeholder}
                onChange={(e) => {
                  const value = item.input_type === 'checkbox' 
                    ? e.target.checked 
                    : e.target.value;
                  onPreferenceChange(item.label, value);
                }}
                onPreferenceEnableChange={(enabled) => onEnableChange(item.label, enabled)}
                min={item.min}
                max={item.max}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

AtakPreferencesSection.displayName = 'AtakPreferencesSection';

export default AtakPreferencesSection; 