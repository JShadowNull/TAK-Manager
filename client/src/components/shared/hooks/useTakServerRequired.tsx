import { useState, useEffect } from 'react';
import { useTakServer } from '../ui/shadcn/sidebar/app-sidebar';

interface UseTakServerRequiredOptions {
  onServerStarted?: () => void;
  title?: string;
  description?: string;
}

export const useTakServerRequired = (options: UseTakServerRequiredOptions = {}) => {
  const { serverState } = useTakServer();
  const [showDialog, setShowDialog] = useState(false);

  // Close dialog and call callback when server becomes running
  useEffect(() => {
    if (serverState?.isRunning && showDialog) {
      setShowDialog(false);
      options.onServerStarted?.();
    }
  }, [serverState?.isRunning, showDialog, options.onServerStarted]);

  const dialogProps = {
    isOpen: showDialog,
    onOpenChange: setShowDialog,
    title: options.title,
    description: options.description
  };

  return {
    showDialog: setShowDialog,
    dialogProps,
    isServerRunning: serverState?.isRunning ?? false
  };
};

export default useTakServerRequired; 