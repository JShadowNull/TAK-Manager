import React, { memo, useCallback } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { AtakPreference, PreferenceState } from './atakPreferencesConfig';
import { Button } from "@/components/shared/ui/shadcn/button";
import { Trash2, Pencil, Plus } from 'lucide-react';
import { Label } from "@/components/shared/ui/shadcn/label";
import { Input } from "@/components/shared/ui/shadcn/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/shared/ui/shadcn/dialog";
import { Checkbox } from "@/components/shared/ui/shadcn/checkbox";
import { Switch } from "@/components/shared/ui/shadcn/switch";
import { Separator } from "@/components/shared/ui/shadcn/separator";

interface AtakCustomSettingsProps {
  customPreferences: AtakPreference[];
  preferences: Record<string, PreferenceState>;
  touchedFields: Record<string, boolean>;
  displayErrors: Record<string, string>;
  deleteMode: boolean;
  selectedSettings: Set<string>;
  showAddDialog: boolean;
  editingPreference: AtakPreference | null;
  newPreference: {
    name: string;
    label: string;
    input_type: 'text' | 'select' | 'number' | 'password';
    defaultValue: string;
  };
  onPreferenceChange: (label: string, value: string) => void;
  onNewPreferenceChange: (field: string, value: string) => void;
  onEnableChange: (label: string, enabled: boolean) => void;
  onBlur: (label: string) => void;
  onToggleSelection: (label: string) => void;
  onSelectAll: () => void;
  onEditPreference: (preference: AtakPreference) => void;
  onSavePreference: () => void;
  onShowAddDialogChange: (open: boolean) => void;
  onRemoveSelectedCustomPreferences: () => void;
  onDeleteModeChange: (mode: boolean) => void;
}

const AtakCustomSettings: React.FC<AtakCustomSettingsProps> = memo(({
  customPreferences,
  preferences,
  touchedFields,
  displayErrors,
  deleteMode,
  selectedSettings,
  showAddDialog,
  editingPreference,
  newPreference,
  onPreferenceChange,
  onNewPreferenceChange,
  onEnableChange,
  onBlur,
  onToggleSelection,
  onSelectAll,
  onEditPreference,
  onSavePreference,
  onShowAddDialogChange,
  onRemoveSelectedCustomPreferences,
  onDeleteModeChange
}) => {
  const handleEnableChange = useCallback((label: string, enabled: boolean) => {
    onEnableChange(label, enabled);
  }, [onEnableChange]);

  const handlePreferenceChange = useCallback((label: string, value: string) => {
    onPreferenceChange(label, value);
  }, [onPreferenceChange]);

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-primary">Custom Settings</h3>
        <div className="flex items-center gap-2">
          {deleteMode ? (
            <>
              <Checkbox
                checked={selectedSettings.size === customPreferences.length}
                onCheckedChange={onSelectAll}
                id="select-all"
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select All
              </label>
              <Button
                variant="danger"
                onClick={() => {
                  onRemoveSelectedCustomPreferences();
                  onDeleteModeChange(false);
                }}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove Selected
              </Button>
              <Button 
                variant="outline"
                onClick={() => onDeleteModeChange(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => onShowAddDialogChange(true)}
              >
                <Plus className="h-4 w-4" />
                Add Custom Setting
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => onDeleteModeChange(true)}
              >
                <Trash2 className="h-4 w-4" />
                Remove Settings
              </Button>
            </>
          )}
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {customPreferences.map((item) => {
          if (deleteMode) {
            return (
              <div key={item.label} className="flex items-center gap-3 p-4 bg-background rounded-lg border border-input">
                <Checkbox
                  checked={selectedSettings.has(item.label)}
                  onCheckedChange={() => onToggleSelection(item.label)}
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
                    onClick={() => onEditPreference(item)}
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
                onBlur={() => onBlur(item.label)}
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

      <Dialog open={showAddDialog} onOpenChange={onShowAddDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPreference ? 'Edit Custom Setting' : 'Add Custom Setting'}</DialogTitle>
            <DialogDescription>
              {editingPreference ? 'Modify existing custom setting' : 'Create a new custom setting'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                type="text"
                value={newPreference.name}
                onChange={(e) => onNewPreferenceChange('name', e.target.value)}
                placeholder="e.g., Custom Map Setting"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="label">Setting Key</Label>
              <Input
                id="label"
                type="text"
                value={newPreference.label}
                onChange={(e) => onNewPreferenceChange('label', e.target.value)}
                placeholder="e.g., custom_map_setting"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Input
                type="select"
                id="type"
                value={newPreference.input_type}
                onChange={(e) => onNewPreferenceChange('input_type', e.target.value)}
                options={[
                  { value: 'text', text: 'Text' },
                  { value: 'number', text: 'Number' },
                  { value: 'password', text: 'Password' }
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultValue">Default Value</Label>
              <Input
                id="defaultValue"
                type="text"
                value={newPreference.defaultValue}
                onChange={(e) => onNewPreferenceChange('defaultValue', e.target.value)}
                placeholder="Default value (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onShowAddDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              onSavePreference();
              onShowAddDialogChange(false);
            }}>
              {editingPreference ? 'Save Changes' : 'Add Setting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

AtakCustomSettings.displayName = 'AtakCustomSettings';

export default AtakCustomSettings;
