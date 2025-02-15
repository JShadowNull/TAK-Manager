import React, { useState } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { CheckCircle, AlertCircle } from "lucide-react";
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

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
  type: 'save' | 'notification';
}

const CertificateConfigEditor: React.FC<CertificateConfigEditorProps> = ({
  identifier,
  isOpen,
  onClose,
  onSave
}) => {
  const [xmlContent, setXmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({
    show: false,
    title: '',
    message: '',
    type: 'notification'
  });

  const showNotification = (title: string, message: string) => {
    setDialog({
      show: true,
      title,
      message,
      type: 'notification'
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
      showNotification('Error', `Failed to load configuration: ${errorMessage}`);
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
      showNotification('Validation Error', errorMessage);
      return false;
    }
  };

  const handleSave = async () => {
    try {
      // Validate first
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
        showNotification('Success', 'Certificate configuration saved successfully.');
        onSave();
        onClose();
      } else {
        throw new Error(data.error || data.detail || 'Failed to save configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to save configuration: ${errorMessage}`);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Certificate Configuration</DialogTitle>
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
    </>
  );
};

export default CertificateConfigEditor; 