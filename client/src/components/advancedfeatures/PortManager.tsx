import { useState, useEffect, useCallback } from 'react';

// Types
export interface PortChange {
  portsToAdd: number[];
  portsToRemove: number[];
}

export interface PortState {
  isLoading: boolean;
  isProcessing: boolean;
  message: string;
  error: string | null;
  changes: PortChange;
  lastCheckedXml: string; // Add this to track the last XML we checked
}

// Extracts ports from XML content
export const extractPortsFromXml = (xmlContent: string): number[] => {
  try {
    const parser = new DOMParser(); // Browser's built-in DOMParser
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    const ports: number[] = [];
    
    // Extract ports from input elements
    const inputElements = xmlDoc.getElementsByTagName('input');
    for (let i = 0; i < inputElements.length; i++) {
      const portAttr = inputElements[i].getAttribute('port');
      if (portAttr) {
        ports.push(parseInt(portAttr, 10));
      }
    }
    
    // Extract ports from connector elements
    const connectorElements = xmlDoc.getElementsByTagName('connector');
    for (let i = 0; i < connectorElements.length; i++) {
      const portAttr = connectorElements[i].getAttribute('port');
      if (portAttr) {
        ports.push(parseInt(portAttr, 10));
      }
    }
    
    return ports;
  } catch (error) {
    console.error('Error parsing XML:', error);
    return [];
  }
};

// Fetches current port mappings from docker-compose
export const fetchCurrentPorts = async (): Promise<number[]> => {
  try {
    const response = await fetch('/api/port-manager/ports');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ports: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.port_mappings) {
      // Extract host ports from port mappings (format: "host_port:container_port")
      return data.port_mappings.map((mapping: string) => {
        const [hostPort] = mapping.split(':');
        return parseInt(hostPort, 10);
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching current ports:', error);
    throw error;
  }
};

// Detects changes between XML ports and current docker ports
export const detectPortChanges = (xmlPorts: number[], currentPorts: number[]): PortChange => {
  const portsToAdd = xmlPorts.filter(port => !currentPorts.includes(port));
  const portsToRemove = currentPorts.filter(port => !xmlPorts.includes(port));
  
  return { portsToAdd, portsToRemove };
};

// Generates a message describing the port changes
export const generatePortChangeMessage = (changes: PortChange): string => {
  const { portsToAdd, portsToRemove } = changes;
  
  if (portsToAdd.length === 0 && portsToRemove.length === 0) {
    return 'No port changes detected.';
  }
  
  let message = 'Detected port changes: ';
  
  if (portsToAdd.length > 0) {
    message += `ports ${portsToAdd.join(', ')} will be added`;
    
    if (portsToRemove.length > 0) {
      message += ', ';
    }
  }
  
  if (portsToRemove.length > 0) {
    message += `ports ${portsToRemove.join(', ')} will be removed`;
  }
  
  return message;
};

// Apply port changes using our API
export const applyPortChanges = async (changes: PortChange): Promise<void> => {
  const { portsToAdd, portsToRemove } = changes;
  
  // Add ports
  for (const port of portsToAdd) {
    const response = await fetch('/api/port-manager/ports/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host_port: port,
        container_port: port
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add port ${port}: ${response.status} ${response.statusText}`);
    }
  }
  
  // Remove ports
  for (const port of portsToRemove) {
    const response = await fetch('/api/port-manager/ports/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host_port: port,
        container_port: port
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to remove port ${port}: ${response.status} ${response.statusText}`);
    }
  }
};

// Modified usePortManager hook to use toast
export const usePortManager = (xmlContent: string) => {
  const [state, setState] = useState<PortState>({
    isLoading: false,
    isProcessing: false,
    message: '',
    error: null,
    changes: { portsToAdd: [], portsToRemove: [] },
    lastCheckedXml: ''
  });
  
  // Create a memoized version of the checkPortChanges function
  const checkPortChanges = useCallback(async (showLoading = true): Promise<PortChange> => {
    if (!xmlContent) return { portsToAdd: [], portsToRemove: [] };
    
    // Check if we already have checked this exact XML and can return cached result
    if (xmlContent === state.lastCheckedXml && 
        (state.changes.portsToAdd.length > 0 || state.changes.portsToRemove.length > 0)) {
      return state.changes;
    }
    
    // Only set loading state if needed
    if (showLoading) {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    }
    
    try {
      // Extract ports from XML
      const xmlPorts = extractPortsFromXml(xmlContent);
      
      // Fetch current ports from docker-compose
      const currentPorts = await fetchCurrentPorts();
      
      // Detect changes
      const changes = detectPortChanges(xmlPorts, currentPorts);
      
      // Generate message
      const message = generatePortChangeMessage(changes);
      
      // Update state with results and cache the XML we checked
      setState(prev => ({
        ...prev,
        isLoading: showLoading ? false : prev.isLoading,
        message,
        changes,
        lastCheckedXml: xmlContent
      }));
      
      return changes;
    } catch (error) {
      console.error('Error checking port changes:', error);
      setState(prev => ({
        ...prev,
        isLoading: showLoading ? false : prev.isLoading,
        error: 'Failed to check port changes. Please try again.',
        lastCheckedXml: '' // Clear the cached XML on error
      }));
      
      return { portsToAdd: [], portsToRemove: [] };
    }
  }, [xmlContent, state.lastCheckedXml, state.changes]);
  
  // Run check when XML content changes, but only after initial load
  useEffect(() => {
    // Only run if we have content and it's different from last checked
    if (xmlContent && xmlContent !== state.lastCheckedXml) {
      const timeoutId = setTimeout(() => {
        checkPortChanges(false); // Don't show loading state for background checks
      }, 300); // Debounce for 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [xmlContent, state.lastCheckedXml, checkPortChanges]);
  
  const applyChanges = async () => {
    const { changes } = state;
    
    if (changes.portsToAdd.length === 0 && changes.portsToRemove.length === 0) {
      return;
    }
    
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      await applyPortChanges(changes);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        message: 'Port changes applied successfully.',
        changes: { portsToAdd: [], portsToRemove: [] }
      }));
      
      // Remove toast notification
    } catch (error) {
      console.error('Error applying port changes:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to apply port changes. Please try again.'
      }));
      
      // Remove toast notification
    }
  };
  
  return {
    state,
    checkPortChanges,
    applyChanges
  };
}; 