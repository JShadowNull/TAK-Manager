import React from 'react';
import { ScrollArea } from './scroll-area';
import { TerminalLine } from '@/components/takserver/hooks/useSSE';

interface TerminalProps {
  lines: TerminalLine[];
}

export const Terminal: React.FC<TerminalProps> = ({ lines }) => {
  const terminalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <ScrollArea className="w-full rounded-md border p-4 bg-background h-[300px]">
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div 
            key={index}
            className={`font-mono text-sm whitespace-pre-wrap ${line.isError ? 'text-destructive' : 'text-foreground'}`}
          >
            {line.timestamp && (
              <span className="text-muted-foreground mr-2">
                {new Date(line.timestamp).toLocaleTimeString()}
              </span>
            )}
            {line.message}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}; 