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
import { CheckCircle, AlertCircle, CircleCheckBig, Pencil, RefreshCcw } from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { useTakServer } from '../shared/ui/shadcn/sidebar/app-sidebar';

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
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
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
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
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
                onClose();
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