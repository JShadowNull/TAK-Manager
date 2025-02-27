import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/shadcn/card/card";
import { ScrollArea } from "@/components/shared/ui/shadcn/scroll-area";
import { Button } from "@/components/shared/ui/shadcn/button";
import { Terminal, ArrowDown, FileText, Search } from "lucide-react";
import { Input } from "@/components/shared/ui/shadcn/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/shadcn/dialog";

interface LogFile {
  id: string;
  name: string;
  path: string;
  modified: number;
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogFile | null>(null);
  const [logContent, setLogContent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const shouldAutoScroll = useRef(true);

  // Filter logs and highlight search matches
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logContent.map(log => ({ text: log, html: log }));
    
    const query = searchQuery.toLowerCase();
    return logContent
      .filter(log => log.toLowerCase().includes(query))
      .map(log => {
        const parts = log.split(new RegExp(`(${searchQuery})`, 'gi'));
        const html = parts.map((part) => 
          part.toLowerCase() === searchQuery.toLowerCase()
            ? `<span class="bg-yellow-500/20 text-foreground">${part}</span>`
            : part
        ).join('');
        return { text: log, html };
      });
  }, [logContent, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [filteredLogs]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScroll.current = isAtBottom;
  };

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/advanced/takserver/logs/list');
      const data = await response.json();
      
      if (response.ok) {
        setLogs(data.logs);
      } else {
        throw new Error(data.detail || 'Failed to fetch logs');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLog = async (log: LogFile) => {
    setSelectedLog(log);
    setLogContent([]);
    setError(null);
    setSearchQuery('');
    shouldAutoScroll.current = true;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/advanced/takserver/logs/${log.id}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          setLogContent(prev => [...prev, data.message]);
        } catch (error) {
          console.error('Error parsing log data:', error);
        }
      });

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          setError(data.error || 'Failed to connect to log stream');
        } catch (error) {
          setError('Failed to connect to log stream');
        }
      });

      eventSource.onerror = () => {
        setError('Connection to log stream lost');
        eventSource.close();
      };
    } catch (error) {
      setError('Failed to connect to log stream');
    }
  };

  const handleCloseLog = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setSelectedLog(null);
    setLogContent([]);
    setError(null);
    setSearchQuery('');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          TAK Server Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No logs found
            </div>
          ) : (
            <div className="grid gap-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{log.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Last modified: {formatDate(log.modified)}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleViewLog(log)}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Logs
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && handleCloseLog()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col gap-4 !p-0">
          <DialogHeader className="gap-4 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Terminal className="h-5 w-5" />
              {selectedLog?.name}
            </DialogTitle>
            <div className="flex items-center justify-between">
              <div className="relative w-96">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  shouldAutoScroll.current = true;
                  scrollToBottom();
                }}
                className="gap-2"
              >
                <ArrowDown className="h-4 w-4" />
                Scroll to Bottom
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden border rounded-lg mx-4">
            <ScrollArea 
              className="h-full font-mono text-muted-foreground text-sm bg-background px-2 [&_*::selection]:bg-blue-500/80 [&_*::selection]:text-primary"
              onScroll={handleScroll}
            >
              <div ref={scrollAreaRef}>
                {error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-destructive">{error}</div>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">
                      {searchQuery ? 'No matching logs found' : 'No logs available'}
                    </div>
                  </div>
                ) : (
                  <div>
                    {filteredLogs.map((log, index) => (
                      <div 
                        key={index} 
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: log.html.replace(/bg-yellow-500\/20/g, 'bg-blue-500/80') }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="px-6 py-4 flex justify-end">
            <Button
              variant="outline"
              onClick={handleCloseLog}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LogViewer; 