import React from 'react';
import { ScrollArea } from '../../shared/ui/shadcn/scroll-area';

export function TransferLog({ logs = [] }) {
  const getLogStyle = (log) => {
    const message = log.message || '';
    
    if (message.includes('Error:')) {
      return 'text-red-500';
    }
    if (message.includes('Device connected')) {
      return 'text-green-500';
    }
    if (message.includes('Device disconnected')) {
      return 'text-yellow-500';
    }
    return 'text-gray-500';
  };

  return (
    <div className="bg-background rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-4">Transfer Log</h2>
      <ScrollArea className="h-[200px] w-full rounded-md border p-4">
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={index} className={`text-sm ${getLogStyle(log)}`}>
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleTimeString()} -{' '}
              </span>
              {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-sm text-muted-foreground">No logs yet...</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 