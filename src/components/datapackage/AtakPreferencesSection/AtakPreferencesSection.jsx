import React, { useEffect } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, validateAtakPreferences } from './atakPreferencesConfig';

const AtakPreferencesSection = ({ 
  preferences, 
  onPreferenceChange, 
  onEnableChange, 
  onValidationChange 
}) => {
  // Initialize all preferences as enabled by default
  useEffect(() => {
    ATAK_PREFERENCES.forEach((item) => {
      const pref = preferences[item.label];
      
      if (!pref) {
        // For new preferences, set both value and enabled state
        onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        onEnableChange(item.label, true);
      } else {
        // For existing preferences, ensure they're enabled if not explicitly set
        if (pref.enabled === undefined) {
          onEnableChange(item.label, true);
        }
        // Initialize value if undefined
        if (pref.value === undefined) {
          onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        }
      }
    });
  }, []);

  // Validate preferences whenever they change
  useEffect(() => {
    const errors = validateAtakPreferences(preferences);
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

      <div className="divide-y divide-accentBoarder">
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
};

export default AtakPreferencesSection; 