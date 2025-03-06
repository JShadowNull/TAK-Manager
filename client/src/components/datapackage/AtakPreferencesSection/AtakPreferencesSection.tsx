import React, { useEffect, memo, useCallback, useState, useMemo } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, PREFERENCE_CATEGORIES, PreferenceState, addCustomPreference, loadCustomPreferences, saveCustomPreferences, AtakPreference} from './atakPreferencesConfig';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { atakPreferenceSchema } from '../shared/validationSchemas';
import { Switch } from "@/components/shared/ui/shadcn/switch";
import { z } from 'zod';
import { Label } from "@/components/shared/ui/shadcn/label";
import { AtakConfirmDefaults } from './atakConfirmDefaults';
import { AtakPreferencesNav } from './AtakPreferencesNav';
import AtakCustomSettings from './AtakCustomSettings';
import { Input } from "@/components/shared/ui/shadcn/input";
import { Search } from 'lucide-react';
import { Separator } from "@/components/shared/ui/shadcn/separator";
import { AtakPreferencesImport } from './AtakPreferencesImport';


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
  const [customPreferences, setCustomPreferences] = useState<AtakPreference[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPreference, setEditingPreference] = useState<AtakPreference | null>(null);
  const [newPreference, setNewPreference] = useState<{
    name: string;
    label: string;
    input_type: 'text' | 'select' | 'number' | 'password';
    defaultValue: string;
  }>({
    name: '',
    label: '',
    input_type: 'text',
    defaultValue: ''
  });
  const [selectedSettings, setSelectedSettings] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(
    Object.keys(PREFERENCE_CATEGORIES)[0]
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);

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

  // Load custom preferences on mount
  useEffect(() => {
    const loaded = loadCustomPreferences();
    setCustomPreferences(loaded);
  }, []);

  // Add custom preferences to ATAK_PREFERENCES
  const allPreferences = [...ATAK_PREFERENCES, ...customPreferences];

  // Combined search filtering logic
  const filteredPreferences = useMemo(() => {
    if (!searchTerm) return allPreferences;
    const lowerSearch = searchTerm.toLowerCase();
    return allPreferences.filter(pref =>
      pref.name.toLowerCase().includes(lowerSearch) ||
      pref.label.toLowerCase().includes(lowerSearch)
    );
  }, [allPreferences, searchTerm]);

  // Validate a single field
  const validateField = useCallback((label: string): Record<string, string> => {
    const pref = preferences[label];
    const prefConfig = allPreferences.find(p => p.label === label);
    
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
  }, [preferences, allPreferences]);

  // Validate all fields regardless of interaction
  const validateAll = useCallback(() => {
    const allErrors: Record<string, string> = {};
    
    allPreferences.forEach(item => {
      const fieldErrors = validateField(item.label);
      Object.assign(allErrors, fieldErrors);
    });

    onValidationChange(allErrors);
    return allErrors;
  }, [validateField, onValidationChange, allPreferences]);

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
    
    // Reset both default and custom preferences
    ATAK_PREFERENCES.forEach((item) => {
      onPreferenceChange(item.label, item.defaultValue || '');
      onEnableChange(item.label, false);
    });
    
    // Clear custom preferences
    setCustomPreferences([]);
    saveCustomPreferences([]);
    
    // Clear selections
    setSelectedSettings(new Set());
    
    setDisplayErrors({});
    setTouchedFields({});
    validateAll();
    
    // Close dialog immediately after confirming
    setResetDialogOpen(false);
  }, [onPreferenceChange, onEnableChange, validateAll]);

  // Add toggle selection handler
  const handleToggleSelection = useCallback((label: string) => {
    setSelectedSettings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  }, []);

  // Update remove function to handle selected settings
  const handleRemoveSelectedCustomPreferences = useCallback(() => {
    if (selectedSettings.size === 0) return;

    // Clean up selected preferences
    const updatedPreferences = customPreferences.filter(pref => !selectedSettings.has(pref.label));
    
    // Clean up state for removed preferences
    selectedSettings.forEach(label => {
      onPreferenceChange(label, '');
      onEnableChange(label, false);

      setDisplayErrors(prev => {
        const { [label]: _, ...rest } = prev;
        return rest;
      });
      setTouchedFields(prev => {
        const { [label]: _, ...rest } = prev;
        return rest;
      });
    });

    // Update custom preferences
    setCustomPreferences(updatedPreferences);
    saveCustomPreferences(updatedPreferences);
    setSelectedSettings(new Set());
  }, [customPreferences, selectedSettings, onPreferenceChange, onEnableChange]);

  // Add select all handler
  const handleSelectAll = useCallback(() => {
    if (selectedSettings.size === customPreferences.length) {
      setSelectedSettings(new Set());
    } else {
      setSelectedSettings(new Set(customPreferences.map(pref => pref.label)));
    }
  }, [customPreferences, selectedSettings]);

  const handleEditPreference = useCallback((preference: AtakPreference) => {
    setEditingPreference(preference);
    setNewPreference({
      name: preference.name,
      label: preference.label,
      input_type: preference.input_type,
      defaultValue: preference.defaultValue || ''
    });
    setShowAddDialog(true);
  }, []);

  const handleSavePreference = useCallback(() => {
    if (!newPreference.name || !newPreference.label) {
      return;
    }

    if (editingPreference) {
      // Update existing preference
      const updatedPreferences = customPreferences.map(pref => 
        pref.label === editingPreference.label ? {
          ...pref,
          name: newPreference.name,
          label: newPreference.label,
          input_type: newPreference.input_type,
          defaultValue: newPreference.defaultValue
        } : pref
      );

      // Update the preference state with the new label
      const updatedPreferenceState = { ...preferences };
      if (editingPreference.label !== newPreference.label) {
        const oldPrefState = updatedPreferenceState[editingPreference.label];
        delete updatedPreferenceState[editingPreference.label];
        updatedPreferenceState[newPreference.label] = oldPrefState;
        onPreferenceChange(newPreference.label, oldPrefState?.value || newPreference.defaultValue || '');
        onEnableChange(newPreference.label, oldPrefState?.enabled || false);
      }

      setCustomPreferences(updatedPreferences);
      saveCustomPreferences(updatedPreferences);
      
      // Update the preference value if needed
      if (newPreference.defaultValue !== editingPreference.defaultValue) {
        onPreferenceChange(newPreference.label, newPreference.defaultValue);
      }
    } else {
      // Add new preference
      const updated = addCustomPreference(
        customPreferences,
        newPreference.name,
        newPreference.label,
        newPreference.input_type,
        undefined,
        newPreference.defaultValue
      );

      setCustomPreferences(updated);
      saveCustomPreferences(updated);
      onPreferenceChange(newPreference.label, newPreference.defaultValue || '');
      onEnableChange(newPreference.label, false);
    }

    setShowAddDialog(false);
    setEditingPreference(null);
    setNewPreference({
      name: '',
      label: '',
      input_type: 'text',
      defaultValue: ''
    });
  }, [newPreference, editingPreference, customPreferences, onPreferenceChange, onEnableChange, preferences]);

  const handleNewPreferenceChange = useCallback((field: string, value: string) => {
    setNewPreference(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  return (
    <div className="h-screen overflow-auto">
      <div className="bg-background p-4">
        <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-md border border-border">
          <Label className="text-lg font-medium">ATAK Settings</Label>
          <div className="flex gap-2">
            <AtakPreferencesImport
              showImportDialog={showImportDialog}
              onShowImportDialogChange={setShowImportDialog}
              preferences={preferences}
              customPreferences={customPreferences}
              allPreferences={allPreferences}
              onPreferenceChange={onPreferenceChange}
              onEnableChange={onEnableChange}
              onCustomPreferencesChange={(prefs) => {
                setCustomPreferences(prefs);
                saveCustomPreferences(prefs);
              }}
            />
            <AtakConfirmDefaults 
              handleReset={handleReset}
              showDefaultDialog={resetDialogOpen}
              onDefaultDialogChange={setResetDialogOpen}
            />
          </div>
        </div>
        <div className="mt-4 bg-card p-4 rounded-lg shadow-md border border-border">
          <Label className="text-lg font-medium mb-4 block">Locate</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search settings..."
              className="w-full pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <AtakPreferencesNav 
        activeCategory={activeCategory} 
        onCategoryChange={setActiveCategory} 
        categories={PREFERENCE_CATEGORIES}
      />

      <ScrollArea className="h-full border border-border rounded-lg">
        <div className="space-y-6 px-4">
          {searchTerm ? (
            <div className="bg-card p-4 rounded-lg break-words">
              <div className="sticky top-0 bg-card z-10 pt-5">
                <h3 className="text-xl font-semibold text-primary">
                  Search Results ({filteredPreferences.length})
                </h3>
                <Separator className="my-5"/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPreferences.length === 0 ? (
                  <div className="text-muted-foreground col-span-full py-2 text-center">
                    No settings found matching "{searchTerm}"
                  </div>
                ) : (
                  filteredPreferences.map((item) => {
                    const pref = preferences[item.label] || {};
                    const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : false;
                    const fieldValue = pref.value !== undefined ? pref.value : '';
                    
                    return (
                      <div key={item.label} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{item.name}</span>
                          <Switch
                            checked={isPreferenceEnabled}
                            onCheckedChange={(enabled) => handleEnableChange(item.label, enabled)}
                          />
                        </div>
                        <PreferenceItem
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
                          showLabel={false}
                          showEnableToggle={false}
                          error={touchedFields[item.label] ? displayErrors[item.label] : undefined}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // Existing category view
            Object.entries(PREFERENCE_CATEGORIES)
              .filter(([key]) => key === activeCategory)
              .map(([categoryKey, categoryName]) => {
                if (categoryKey === 'CUSTOM') {
                  return (
                    <div key="custom" className="bg-card p-4 rounded-lg shadow-lg break-words">
                      <AtakCustomSettings
                        customPreferences={customPreferences}
                        preferences={preferences}
                        touchedFields={touchedFields}
                        displayErrors={displayErrors}
                        deleteMode={deleteMode}
                        selectedSettings={selectedSettings}
                        showAddDialog={showAddDialog}
                        editingPreference={editingPreference}
                        newPreference={newPreference}
                        onPreferenceChange={handlePreferenceChange}
                        onEnableChange={handleEnableChange}
                        onBlur={handleBlur}
                        onToggleSelection={handleToggleSelection}
                        onSelectAll={handleSelectAll}
                        onEditPreference={handleEditPreference}
                        onSavePreference={handleSavePreference}
                        onShowAddDialogChange={setShowAddDialog}
                        onRemoveSelectedCustomPreferences={handleRemoveSelectedCustomPreferences}
                        onDeleteModeChange={setDeleteMode}
                        onNewPreferenceChange={handleNewPreferenceChange}
                      />
                    </div>
                  );
                }

                const categoryPreferences = allPreferences.filter(item => item.category === categoryKey);
                if (categoryPreferences.length === 0) return null;

                return (
                  <div key={categoryKey} className="bg-card p-4 rounded-lg shadow-lg break-words">
                    <div className="sticky top-0 bg-card z-10 pt-5">
                      <h3 className="text-xl font-semibold text-primary">
                        {categoryName}
                      </h3>
                      <Separator className="my-5"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryPreferences.map((item) => {
                        const pref = preferences[item.label] || {};
                        const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : false;
                        const fieldValue = pref.value !== undefined ? pref.value : '';

                        return (
                          <div key={item.label} className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium w-10/12">{item.name}</span>
                              <Switch
                                checked={isPreferenceEnabled}
                                onCheckedChange={(enabled) => handleEnableChange(item.label, enabled)}
                              />
                            </div>
                            <PreferenceItem
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
                              showLabel={false}
                              showEnableToggle={false}
                              error={touchedFields[item.label] ? displayErrors[item.label] : undefined}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

AtakPreferencesSection.displayName = 'AtakPreferencesSection';

export default AtakPreferencesSection; 