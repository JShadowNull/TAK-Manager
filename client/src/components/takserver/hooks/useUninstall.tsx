import { useState } from 'react';
import { useTaskStatus } from '../../shared/hooks/useTaskStatus';
import { useTerminalOutput } from '../../shared/hooks/useTerminalOutput';
import type { UninstallOptions } from '../types';

export const useUninstall = (options: UninstallOptions) => {
  const [isUninstalling, setIsUninstalling] = useState(false);
  const { status, message } = useTaskStatus(options.taskId);
  const { lines, clear } = useTerminalOutput(options.taskId);

  const handleUninstall = async () => {
    try {
      setIsUninstalling(true);
      await fetch('/api/takserver/uninstall', { method: 'POST' });
    } catch (error) {
      console.error('Failed to start uninstallation:', error);
      options.onError?.(error instanceof Error ? error.message : 'Failed to start uninstallation');
    }
  };

  const handleComplete = () => {
    setIsUninstalling(false);
    clear();
    options.onComplete?.();
  };

  return {
    isUninstalling,
    status,
    message,
    lines,
    handleUninstall,
    handleComplete
  };
}; 