import React, { useState, ReactNode } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { CheckCircle, AlertCircle, CircleCheckBig, Pencil, RefreshCcw, Wand2, Eye, EyeOff, Plus } from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { useTakServer } from '../shared/ui/shadcn/sidebar/app-sidebar';
import { Input } from "@/components/shared/ui/shadcn/input";
import { toast } from "../shared/ui/shadcn/toast/use-toast";
import { Label } from "@/components/shared/ui/shadcn/label";
import { HelpIconTooltip } from "@/components/shared/ui/shadcn/tooltip/HelpIconTooltip";
import { passwordSchema, groupSchema } from './hooks/useCertificateValidation';
import { z } from 'zod';

interface CertificateConfigEditorProps {
  identifier: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface DialogState {
  show: boolean;
  title: string;
  message: string;
  type: 'save' | 'notification' | 'success' | 'error';
  icon?: ReactNode;
  showRestartButton?: boolean;
}

const CertificateConfigEditor: React.FC<CertificateConfigEditorProps> = ({
  identifier,
  isOpen,
  onClose,
  onSave
}) => {
  const [xmlContent, setXmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'notification'
  });
  const [successDialog, setSuccessDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });
  const [errorDialog, setErrorDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'error'
  });
  const { setServerState } = useTakServer();
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [groupValue, setGroupValue] = useState('');
  const [roleValue, setRoleValue] = useState('');
  const [groupInValue, setGroupInValue] = useState('');
  const [groupOutValue, setGroupOutValue] = useState('');

  const generateSecurePassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!+-:,.';
    
    // Ensure at least one of each required type
    let password = [
      lowercase[Math.floor(Math.random() * lowercase.length)],
      uppercase[Math.floor(Math.random() * uppercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ].join('');

    // Fill remaining length with random characters
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < 15; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to randomize character order
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const showSuccessNotification = (message: string, title: string, icon: ReactNode, showRestartButton: boolean = true) => {
    setSuccessDialog({
      show: true,
      title,
      message,
      type: 'success',
      icon,
      showRestartButton
    });
  };

  const showErrorNotification = (message: string) => {
    setErrorDialog({
      show: true,
      title: 'Error',
      message,
      type: 'error'
    });
  };

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/certmanager/certificates/${identifier}/config`);
      const data = await response.json();
      
      if (response.ok) {
        setXmlContent(data.content);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data.content, "text/xml");
        const ns = "http://bbn.com/marti/xml/bindings";
        
        // Get role attribute
        const role = xmlDoc.documentElement.getAttribute('role') || '';
        setRoleValue(role);

        // Get all group types
        const getGroups = (type: string) => {
          const elements = xmlDoc.getElementsByTagNameNS(ns, type);
          return Array.from(elements).map(el => el.textContent).filter(Boolean) as string[];
        };

        setGroupValue(getGroups('groupList').join(', '));
        setGroupInValue(getGroups('groupListIN').join(', '));
        setGroupOutValue(getGroups('groupListOUT').join(', '));
      } else {
        throw new Error(data.error || data.detail || 'Failed to fetch configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorNotification(`Failed to load configuration: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && identifier) {
      fetchConfig();
    }
  }, [isOpen, identifier]);

  const validateConfig = async (content: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/certmanager/certificates/${identifier}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      
      if (!response.ok || !data.valid) {
        throw new Error(data.error || data.detail || 'Invalid XML configuration');
      }
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorNotification(`Validation Error: ${errorMessage}`);
      return false;
    }
  };

  const handleSave = async () => {
    try {
      // Validate first
      showSuccessNotification('Saving configuration...', 'Saving...', <RefreshCcw style={{ animation: 'spin 1s linear infinite', animationDirection: 'reverse' }} className="h-5 w-5 text-primary" />);
      const isValid = await validateConfig(xmlContent);
      if (!isValid) return;

      // Save if valid
      const response = await fetch(`/api/certmanager/certificates/${identifier}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: xmlContent }),
      });
      
      const data = await response.json();
      if (response.ok) {
        showSuccessNotification('Certificate configuration saved successfully. Restart TAK Server to apply changes.', 'Success', <CircleCheckBig className="h-5 w-5 text-green-500 dark:text-green-600" />);
        onSave();
      } else {
        throw new Error(data.error || data.detail || 'Failed to save configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorNotification(`Failed to save configuration: ${errorMessage}`);
    }
  };

  const handleRestart = async () => {
    try {
      setServerState(prev => ({ ...prev, isRestarting: true }));
      setIsLoading(true);
      setIsOperationInProgress(true);
      showSuccessNotification('TAK Server is restarting...', 'Restarting...', <RefreshCcw style={{ animation: 'spin 1s linear infinite', animationDirection: 'reverse' }} className="h-5 w-5 text-primary" />);
      const response = await fetch(`/api/takserver/restart-takserver`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.detail || 'Restart failed');
      }

      // Success notification but keep isRestarting true until status update
      showSuccessNotification('TAK Server restarted successfully.', 'Success', <CircleCheckBig className="h-5 w-5 text-green-500 dark:text-green-600" />, false);
    } catch (error: unknown) {
      setServerState(prev => ({ ...prev, isRestarting: false }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showSuccessNotification(`Failed to restart TAK Server: ${errorMessage}`, 'Error', <AlertCircle className="h-5 w-5 text-destructive" />);
    } finally {
      setIsOperationInProgress(false);
      setIsLoading(false);
      handleClose();
    }
  };

  const handleGenerateHash = async () => {
    try {
      // Validate password using shared schema
      passwordSchema.parse(passwordValue);
    } catch (error) {
      const errorMessages = error instanceof z.ZodError 
        ? error.errors.map(err => err.message).join(', ')
        : 'Invalid password';
        
      toast({
        title: "Invalid Password",
        description: errorMessages,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/certmanager/certificates/generate-password-hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordValue }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to generate hash');

      // Update XML content with new hash
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const userElement = xmlDoc.documentElement;

      // Set password attributes
      userElement.setAttribute('passwordHashed', 'true');
      userElement.setAttribute('password', data.hash);
      
      // Serialize back to XML string
      const serializer = new XMLSerializer();
      const newXml = serializer.serializeToString(xmlDoc);
      
      setXmlContent(newXml);
      
      toast({
        title: "Success",
        description: "Password hash generated and updated in XML!",
        variant: "success"
      });

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      toast({
        title: "Error",
        description: `Hash generation failed: ${err.message}`,
        variant: "destructive"
      });
    }
  };

  const handleAddGroups = (groupType: 'groupList' | 'groupListIN' | 'groupListOUT' = 'groupList', inputValue = groupValue) => {
    const validatedGroups = groupSchema.parse(inputValue);
    
    const invalidGroups = validatedGroups.split(',').filter(g => !/^[a-zA-Z0-9_-]+$/.test(g));
    if (invalidGroups.length > 0) {
      toast({
        title: "Error",
        description: `Invalid groups: ${invalidGroups.join(', ')}. Only letters, numbers, underscores, and hyphens allowed.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const ns = "http://bbn.com/marti/xml/bindings";
      
      // Remove ALL group elements first
      ['groupList', 'groupListIN', 'groupListOUT'].forEach(type => {
        const elements = xmlDoc.getElementsByTagNameNS(ns, type);
        Array.from(elements).forEach(el => el.remove());
      });

      // Add elements in schema-defined order
      const groupTypes = [
        { type: 'groupList', value: groupValue },
        { type: 'groupListIN', value: groupInValue },
        { type: 'groupListOUT', value: groupOutValue }
      ];

      groupTypes.forEach(({ type, value }) => {
        const groups = value.split(',')
          .map(g => g.trim())
          .filter(g => g.length > 0);

        groups.forEach(group => {
          const element = xmlDoc.createElementNS(ns, type);
          element.textContent = group;
          xmlDoc.documentElement.appendChild(xmlDoc.createTextNode('\n  '));
          xmlDoc.documentElement.appendChild(element);
        });
      });

      // Update XML content
      const serializer = new XMLSerializer();
      let newXml = serializer.serializeToString(xmlDoc)
        .replace(/\n\s*\n/g, '\n')
        .replace(/<\/User>/, '\n</User>');
        
      setXmlContent(newXml);
      toast({ title: "Success", description: `${groupType} updated!`, variant: "success" });

    } catch (error) {
      const errorMessage = error instanceof z.ZodError
        ? error.errors[0].message
        : 'Invalid group format';

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleRoleChange = (newRole: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    xmlDoc.documentElement.setAttribute('role', newRole);
    const serializer = new XMLSerializer();
    setXmlContent(serializer.serializeToString(xmlDoc));
    setRoleValue(newRole);
  };

  const handleClose = () => {
    setPasswordValue('');
    setGroupValue('');
    setGroupInValue('');
    setGroupOutValue('');
    setRoleValue('');
    onClose();
  };

  // Add role options constant
  const roleOptions = [
    { value: 'ROLE_ADMIN', text: 'Admin' },
    { value: 'ROLE_READONLY', text: 'Read Only' },
    { value: 'ROLE_ANONYMOUS', text: 'Anonymous' },
    { value: 'ROLE_NON_ADMIN_UI', text: 'Non-Admin UI' },
    { value: 'ROLE_WEBTAK', text: 'WebTAK' }
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Certificate Configuration
            </DialogTitle>
            <DialogDescription>
              Edit the XML configuration for certificate: {identifier}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded-md overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <span className="text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <CodeMirror
                  value={xmlContent}
                  height="400px"
                  theme={oneDark}
                  extensions={[xml(), EditorView.lineWrapping, EditorState.allowMultipleSelections.of(true)]}
                  onChange={(value) => setXmlContent(value)}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                  }}
                />
              )}
            </div>
            
            {/* Password & Group Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Password Column */}
              <div>
                <Label>Add Password</Label>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <Input
                      type={passwordVisible ? "text" : "password"}
                      placeholder="Enter password"
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      className="w-full"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <Button
                        type="button"
                        onClick={() => setPasswordVisible(!passwordVisible)}
                        className="h-8 w-8 p-0 hover:bg-transparent text-muted-foreground"
                        variant="ghost"
                        size="icon"
                      >
                        {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPasswordValue(generateSecurePassword())}
                    className="flex-shrink-0 flex items-center gap-2 h-10 w-fit"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateHash}
                    disabled={!passwordValue}
                    className="flex-shrink-0 flex items-center gap-2 h-10"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Role Selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>User Role</Label>
                  <HelpIconTooltip 
                    tooltip="Defines user access privileges. ROLE_ADMIN has full system access"
                    side="top"
                    triggerMode="hover"
                  />
                </div>
                <Input
                  type="select"
                  options={roleOptions}
                  value={roleValue}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Existing Groups Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Groups</Label>
                  <HelpIconTooltip 
                    tooltip="You will receive and send data to these groups."
                    side="top"
                    triggerMode="hover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={groupValue}
                    onChange={(e) => setGroupValue(e.target.value)}
                    placeholder="Groups (comma separated)"
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleAddGroups()}
                  >
                    <Plus className="h-4 w-4" /> Modify
                  </Button>
                </div>
              </div>

              {/* GroupListIN Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Inbound Groups</Label>
                  <HelpIconTooltip 
                    tooltip="You will send data to these groups. You will not receive data from these groups."
                    side="top"
                    triggerMode="hover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={groupInValue}
                    onChange={(e) => setGroupInValue(e.target.value)}
                    placeholder="Inbound groups (comma separated)"
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleAddGroups('groupListIN', groupInValue)}
                  >
                    <Plus className="h-4 w-4" /> Modify
                  </Button>
                </div>
              </div>

              {/* GroupListOUT Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Outbound Groups</Label>
                  <HelpIconTooltip 
                    tooltip="You will receive all data from these groups. These groups will not see your data."
                    side="top"
                    triggerMode="hover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={groupOutValue}
                    onChange={(e) => setGroupOutValue(e.target.value)}
                    placeholder="Outbound groups (comma separated)"
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleAddGroups('groupListOUT', groupOutValue)}
                  >
                    <Plus className="h-4 w-4" /> Modify
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setDialog({
                  show: true,
                  title: 'Save Changes',
                  message: 'Are you sure you want to save these changes?',
                  type: 'save'
                })}
                disabled={isLoading}
                className="h-10"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog.show} onOpenChange={(open) => setDialog(prev => ({ ...prev, show: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog.type === 'notification' && (
                dialog.title.toLowerCase().includes('error') ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )
              )}
              {dialog.title}
            </DialogTitle>
            <DialogDescription>
              {dialog.message}
            </DialogDescription>
          </DialogHeader>

          {dialog.type !== 'notification' && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog(prev => ({ ...prev, show: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setDialog(prev => ({ ...prev, show: false }));
                  if (dialog.type === 'save') {
                    handleSave();
                  }
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={successDialog.show} onOpenChange={() => setSuccessDialog(prev => ({ ...prev, show: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {successDialog.icon}
              {successDialog.title}
            </DialogTitle>
            <DialogDescription>{successDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuccessDialog(prev => ({ ...prev, show: false }));
                handleClose();
              }}
            >
              Close
            </Button>
            {successDialog.showRestartButton !== false && (
              <Button
                variant="primary"
                onClick={handleRestart}
                disabled={isLoading}
                loading={isOperationInProgress}
                loadingText="Restarting..."
              >
                Restart
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorDialog.show} onOpenChange={() => setErrorDialog(prev => ({ ...prev, show: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {errorDialog.title}
            </DialogTitle>
            <DialogDescription>{errorDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setErrorDialog(prev => ({ ...prev, show: false }))}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateConfigEditor; 