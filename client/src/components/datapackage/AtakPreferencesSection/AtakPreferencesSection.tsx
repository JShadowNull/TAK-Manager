import React, { useEffect, memo, useCallback, useState } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { ATAK_PREFERENCES, PREFERENCE_CATEGORIES, PreferenceState, addCustomPreference, loadCustomPreferences, saveCustomPreferences, AtakPreference} from './atakPreferencesConfig';
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { atakPreferenceSchema } from '../shared/validationSchemas';
import { Button } from "@/components/shared/ui/shadcn/button";
import { RotateCcw, Plus, Trash2, Pencil } from 'lucide-react';
import { z } from 'zod';
import { Label } from "@/components/shared/ui/shadcn/label";
import { Input } from "@/components/shared/ui/shadcn/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Switch } from "@/components/shared/ui/shadcn/switch";

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

  return (
    <div className="h-[calc(100vh-200px)] overflow-hidden">
      <div className="bg-background p-4 mb-2">
        <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-md border border-border">
          <Label className="text-lg font-medium">ATAK Settings</Label>
          <div className="flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              if (!open) {
                setEditingPreference(null);
                setNewPreference({
                  name: '',
                  label: '',
                  input_type: 'text',
                  defaultValue: ''
                });
              }
              setShowAddDialog(open);
            }}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  disabled={deleteMode}
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Setting
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPreference ? 'Edit Custom Setting' : 'Add Custom Setting'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Display Name</Label>
                    <Input
                      type="text"
                      value={newPreference.name}
                      onChange={(e) => setNewPreference(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Custom Map Setting"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Setting Key</Label>
                    <Input
                      type="text"
                      value={newPreference.label}
                      onChange={(e) => setNewPreference(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g., custom_map_setting"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Input
                      type="select"
                      value={newPreference.input_type}
                      onChange={(e) => setNewPreference(prev => ({ ...prev, input_type: e.target.value as any }))}
                      options={[
                        { value: 'text', text: 'Text' },
                        { value: 'number', text: 'Number' },
                        { value: 'password', text: 'Password' }
                      ]}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Default Value</Label>
                    <Input
                      type="text"
                      value={newPreference.defaultValue}
                      onChange={(e) => setNewPreference(prev => ({ ...prev, defaultValue: e.target.value }))}
                      placeholder="Default value (optional)"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowAddDialog(false);
                    setEditingPreference(null);
                    setNewPreference({
                      name: '',
                      label: '',
                      input_type: 'text',
                      defaultValue: ''
                    });
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePreference}>
                    {editingPreference ? 'Save Changes' : 'Add Setting'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {customPreferences.length > 0 && (
              <>
                <Button
                  variant={deleteMode ? "danger" : "outline"}
                  className="flex items-center gap-2"
                  onClick={() => {
                    if (deleteMode) {
                      handleRemoveSelectedCustomPreferences();
                    }
                    setDeleteMode(!deleteMode);
                    setSelectedSettings(new Set());
                  }}
                  leadingIcon={<Trash2 className="h-4 w-4" />}
                >
                  {deleteMode ? "Remove Selected" : "Remove Custom Settings"}
                </Button>
              </>
            )}
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex items-center gap-2"
              disabled={deleteMode}
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
      </div>

      <ScrollArea className="h-[calc(100%-80px)]">
        <div className="space-y-6 px-4">
          {/* Render Custom Settings first */}
          {(() => {
            const customPrefs = allPreferences.filter(item => item.category === 'CUSTOM');
            if (customPrefs.length > 0) {
              return (
                <div key="CUSTOM" className="bg-card p-4 rounded-lg shadow-lg border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-semibold text-primary">{PREFERENCE_CATEGORIES.CUSTOM}</h3>
                    </div>
                    {deleteMode && customPrefs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedSettings.size === customPrefs.length}
                          onCheckedChange={handleSelectAll}
                          id="select-all"
                        />
                        <label
                          htmlFor="select-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Select All
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customPrefs.map((item) => {
                      if (deleteMode) {
                        return (
                          <div key={item.label} className="flex items-center gap-3 p-4 bg-background rounded-lg border border-input">
                            <Checkbox
                              checked={selectedSettings.has(item.label)}
                              onCheckedChange={() => handleToggleSelection(item.label)}
                            />
                            <span className="font-medium">{item.name}</span>
                          </div>
                        );
                      }

                      const pref = preferences[item.label] || {};
                      const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : false;
                      const fieldValue = pref.value !== undefined ? pref.value : '';

                      return (
                        <div key={item.label} className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditPreference(item)}
                                className="h-6 w-6 hover:bg-accent"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
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
            }
            return null;
          })()}

          {/* Render all other categories */}
          {Object.entries(PREFERENCE_CATEGORIES)
            .filter(([key]) => key !== 'CUSTOM')
            .map(([categoryKey, categoryName]) => {
              const categoryPreferences = allPreferences.filter(item => item.category === categoryKey);
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
                        <div key={item.label} className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditPreference(item)}
                                className="h-6 w-6 hover:bg-accent"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
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
            })}
        </div>
      </ScrollArea>
    </div>
  );
});

AtakPreferencesSection.displayName = 'AtakPreferencesSection';

export default AtakPreferencesSection; 