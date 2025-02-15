import React, { useState, useEffect } from 'react';
import { Button } from "@/components/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/shadcn/card/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/shared/ui/shadcn/dialog";
import { CheckCircle, AlertCircle } from "lucide-react";
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';

interface NotificationState {
  show: boolean;
  title: string;
  message: string;
  type: 'success' | 'error';
}

const CoreConfigEditor: React.FC = () => {
  const [xmlContent, setXmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const showNotification = (title: string, message: string, type: 'success' | 'error') => {
    setNotification({ show: true, title, message, type });
    
    // Only auto-hide success notifications
    if (type === 'success') {
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 3000);
    }
  };

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/advanced/core-config');
      const data = await response.json();
      
      if (response.ok) {
        setXmlContent(data.content);
      } else {
        throw new Error(data.error || data.detail || 'Failed to fetch configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to load configuration: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfig = async (content: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/advanced/core-config/validate', {
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
      showNotification('Validation Error', errorMessage, 'error');
      return false;
    }
  };

  const handleSave = async () => {
    try {
      // Validate first
      const isValid = await validateConfig(xmlContent);
      if (!isValid) return;

      // Save if valid
      const response = await fetch('/api/advanced/core-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: xmlContent }),
      });
      
      const data = await response.json();
      if (response.ok) {
        showNotification('Success', 'Configuration saved successfully', 'success');
      } else {
        throw new Error(data.error || data.detail || 'Failed to save configuration');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to save configuration: ${errorMessage}`, 'error');
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Core Configuration Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-[600px] border rounded-md overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <CodeMirror
                  value={xmlContent}
                  height="600px"
                  theme={oneDark}
                  extensions={[xml(), EditorView.lineWrapping, EditorState.allowMultipleSelections.of(true)]}
                  onChange={(value) => setXmlContent(value)}
                />
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={fetchConfig}
                disabled={isLoading}
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={notification.show} onOpenChange={(open) => setNotification(prev => ({ ...prev, show: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              {notification.title}
            </DialogTitle>
            <DialogDescription>
              {notification.message}
            </DialogDescription>
          </DialogHeader>
          {notification.type === 'error' && (
            <DialogFooter>
              <Button 
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoreConfigEditor; 