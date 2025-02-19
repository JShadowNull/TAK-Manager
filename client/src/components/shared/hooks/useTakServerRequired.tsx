import { useState, useEffect, useMemo } from 'react';
import { useTakServer } from '../ui/shadcn/sidebar/app-sidebar';

interface UseTakServerRequiredOptions {
  onServerStarted?: () => void;
  title?: string;
  description?: string;
  suppressDuringRestart?: boolean;
}

export const useTakServerRequired = (options: UseTakServerRequiredOptions = {}) => {
  const { serverState } = useTakServer();
  const [showDialog, setShowDialog] = useState(false);

  const shouldShowDialog = useMemo(() => {
    if (options.suppressDuringRestart && serverState?.isRestarting) return false;
    if (serverState?.isRestarting) return false;
    return !serverState?.isRunning;
  }, [serverState?.isRunning, serverState?.isRestarting, options.suppressDuringRestart]);

  useEffect(() => {
    setShowDialog(shouldShowDialog);
  }, [shouldShowDialog]);

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