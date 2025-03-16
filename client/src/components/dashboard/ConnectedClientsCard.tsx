import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/shared/ui/shadcn/card/card';
import { Badge } from '@/components/shared/ui/shadcn/badge';
import { Skeleton } from '@/components/shared/ui/shadcn/skeleton';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTakServer } from '@/components/shared/ui/shadcn/sidebar/app-sidebar';

interface ConnectedClient {
  callsign: string;
  clientUid: string;
  lastReportTime: number;
  takClient: string;
  takVersion: string;
  inGroups: string[];
  outGroups: string[];
  role: string;
  team: string;
  ipAddress: string;
}

interface ConnectedClientsResponse {
  status: string;
  clients: ConnectedClient[];
  message?: string;
  timestamp?: number;
}

// Session storage key
const STORAGE_KEY = 'connected_clients_data';

export const ConnectedClientsCard: React.FC = () => {
  // Get TAK server state from context
  const { serverState } = useTakServer();
  const takServerActive = serverState.isInstalled && serverState.isRunning;
  
  // Initialize state from sessionStorage if available
  const [clients, setClients] = useState<ConnectedClient[]>(() => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached).clients : [];
    } catch (error) {
      console.error('Error loading clients from sessionStorage:', error);
      return [];
    }
  });
  
  const [loading, setLoading] = useState<boolean>(takServerActive && clients.length === 0);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Save to sessionStorage whenever clients change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        clients, 
        timestamp: Date.now() 
      }));
    } catch (error) {
      console.error('Error saving clients to sessionStorage:', error);
    }
  }, [clients]);

  // Effect to handle server state changes
  useEffect(() => {
    if (takServerActive) {
      // Server is active, start fetching and monitoring
      setLoading(clients.length === 0);
      fetchInitialClients();
      setupSSE();
    } else {
      // Server is not active, clean up connections
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Only clear clients if server was previously running and now stopped
      if (serverState.isInstalled && !serverState.isRunning && clients.length > 0) {
        setClients([]);
        setError("TAK Server is not running");
      }
    }
    
    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Only send stop request if server is active
      if (takServerActive) {
        fetch('/api/takserver-api/connected-clients-stream/stop', {
          method: 'POST'
        }).catch(error => {
          console.error('Error stopping client monitoring:', error);
        });
      }
    };
  }, [takServerActive, serverState.isInstalled, serverState.isRunning]);

  // Initial fetch to get data quickly if we don't have cached data
  const fetchInitialClients = async () => {
    if (!takServerActive) {
      return;
    }
    
    if (clients.length > 0) {
      // We already have data from sessionStorage
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/takserver-api/connected-clients');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch connected clients: ${response.statusText}`);
      }
      
      const data: ConnectedClientsResponse = await response.json();
      
      if (data.status === 'success') {
        setClients(data.clients || []);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch connected clients');
        setClients([]);
      }
    } catch (error) {
      console.error('Error fetching connected clients:', error);
      setError('Failed to fetch connected clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Set up SSE connection for real-time updates
  const setupSSE = () => {
    if (!takServerActive) {
      return;
    }
    
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create a new EventSource connection
    const eventSource = new EventSource('/api/takserver-api/connected-clients-stream');
    eventSourceRef.current = eventSource;

    // Handle connected_clients events
    eventSource.addEventListener('connected_clients', (event) => {
      try {
        const data: ConnectedClientsResponse = JSON.parse(event.data);
        
        if (data.status === 'success') {
          setClients(data.clients || []);
          setError(null);
          setLoading(false);
        } else {
          setError(data.message || 'Error in client data stream');
          // Don't clear clients on error to maintain last known state
        }
      } catch (error) {
        console.error('Error processing connected clients event:', error);
        setError('Failed to process client data');
      }
    });

    // Handle connection errors
    eventSource.addEventListener('error', () => {
      console.error('SSE connection error - attempting to reconnect...');
      
      // Close the current connection
      eventSource.close();
      
      // Attempt to reconnect after a delay if server is still active
      if (takServerActive) {
        setTimeout(setupSSE, 5000);
      }
    });
  };

  // Calculate time since last report
  const getTimeSince = (timestamp: number): string => {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // Convert to seconds
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    
    // Convert to minutes
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    
    // Convert to hours
    const hours = Math.floor(minutes / 60);
    
    if (hours < 24) {
      return `${hours}h ago`;
    }
    
    // Convert to days
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Get team color based on team name
  const getTeamColor = (team: string): { backgroundColor: string; textColor: string } => {
    const teamColors: Record<string, { backgroundColor: string; textColor: string }> = {
      'Cyan': { backgroundColor: '#06b6d4', textColor: '#000000' },
      'Blue': { backgroundColor: '#3b82f6', textColor: '#ffffff' },
      'Red': { backgroundColor: '#ef4444', textColor: '#ffffff' },
      'Green': { backgroundColor: '#22c55e', textColor: '#000000' },
      'Yellow': { backgroundColor: '#eab308', textColor: '#000000' },
      'Purple': { backgroundColor: '#a855f7', textColor: '#ffffff' },
      'Orange': { backgroundColor: '#f97316', textColor: '#000000' },
      'White': { backgroundColor: '#f8fafc', textColor: '#000000' },
      'Black': { backgroundColor: '#1e293b', textColor: '#ffffff' },
      'Brown': { backgroundColor: '#854d0e', textColor: '#ffffff' },
      'Magenta': { backgroundColor: '#d946ef', textColor: '#ffffff' },
      'Maroon': { backgroundColor: '#800000', textColor: '#ffffff' },
      'Dark Blue': { backgroundColor: '#1e3a8a', textColor: '#ffffff' },
      'Teal': { backgroundColor: '#0d9488', textColor: '#ffffff' },
      'Dark Green': { backgroundColor: '#166534', textColor: '#ffffff' },
    };
    
    return teamColors[team] || { backgroundColor: '#6b7280', textColor: '#ffffff' }; // Default gray
  };

  // If server is not active, show appropriate message
  if (!takServerActive) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Connected TAK Clients</CardTitle>
          <CardDescription>
            {!serverState.isInstalled ? 'TAK Server is not installed' : 'TAK Server is not running'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg text-muted-foreground">
            {!serverState.isInstalled 
              ? 'Please install TAK Server to view connected clients' 
              : 'Please start TAK Server to view connected clients'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Connected TAK Clients</CardTitle>
        <CardDescription>
          {loading ? 'Loading connected clients...' : 
           error ? error : 
           `${clients.length} client${clients.length !== 1 ? 's' : ''} connected`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col space-y-2 p-4 border rounded-lg">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex space-x-2 pt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-700">
            {error}
          </div>
        ) : clients.length === 0 ? (
          <div className="p-4 border rounded-lg text-muted-foreground">
            No clients currently connected
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border max-h-[400px]">
            <ul className="list-none space-y-2 divide-y divide-border text-sm text-muted-foreground p-2">
              {clients.map((client) => (
                <li key={client.clientUid} className="p-4 rounded flex flex-col space-y-3">
                  {/* Header with callsign and last seen time */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-foreground text-lg">{client.callsign || 'Unknown'}</div>
                      <div className="text-sm">{client.takClient} {client.takVersion}</div>
                    </div>
                    <div className="text-xs text-right">
                      Last seen:<br />{getTimeSince(client.lastReportTime)}
                    </div>
                  </div>
                  
                  {/* All badges in a single row with wrapping for smaller screens */}
                  <div className="flex flex-wrap gap-2">
                    {/* Team badge */}
                    {client.team && (
                      <Badge 
                        className="hover:bg-white" 
                        style={{ 
                          backgroundColor: getTeamColor(client.team).backgroundColor,
                          color: getTeamColor(client.team).textColor
                        }}
                      >
                        Team: {client.team}
                      </Badge>
                    )}
                    
                    {/* Role badge */}
                    {client.role && (
                      <Badge variant="outline">
                        {client.role}
                      </Badge>
                    )}
                    
                    {/* IP address badge */}
                    <Badge variant="outline">
                      {client.ipAddress}
                    </Badge>
                    
                    {/* In groups badges */}
                    {client.inGroups?.map((group, index) => (
                      <Badge key={`in-${index}`} variant="outline" className="flex items-center gap-1">
                        <ArrowDownToLine className="h-3 w-3 text-blue-500" />
                        {group}
                      </Badge>
                    ))}
                    
                    {/* Out groups badges */}
                    {client.outGroups?.map((group, index) => (
                      <Badge key={`out-${index}`} variant="outline" className="flex items-center gap-1">
                        <ArrowUpFromLine className="h-3 w-3 text-green-500" />
                        {group}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectedClientsCard; 