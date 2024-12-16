import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Generic Socket.IO hook for handling WebSocket connections
 * @param {string} namespace - Socket namespace to connect to
 * @param {Object} options - Configuration options
 * @param {Object} eventHandlers - Map of event names to their handlers
 * @param {Object} initialState - Initial state for any custom states needed
 * @returns {Object} Socket instance and utility functions
 */
function useSocket(namespace, {
  eventHandlers = {},
  initialState = {},
  ...options
} = {}) {
  // Basic socket states
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [state, setState] = useState(initialState);
  const [terminalOutput, setTerminalOutput] = useState([]);
  
  const socketRef = useRef(null);
  const handlersRef = useRef(eventHandlers);
  const stateRef = useRef(state);

  // Update refs when props change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clear terminal output
  const clearTerminalOutput = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  // Update state partially
  const updateState = useCallback((updates) => {
    setState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Initialize socket connection
  useEffect(() => {
    // Only create socket if it doesn't exist
    if (!socketRef.current) {
      console.log(`Initializing socket connection to ${namespace}`);
      socketRef.current = io(namespace, {
        transports: ['websocket'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        ...options
      });

      // Handle connection events
      socketRef.current.on('connect', () => {
        console.log(`Socket connected to ${namespace}`);
        setIsConnected(true);
        setError(null);
        
        // Call connect handler if provided
        if (handlersRef.current.onConnect) {
          handlersRef.current.onConnect(socketRef.current);
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.error(`Socket connection error for ${namespace}:`, err);
        setError(err);
        setIsConnected(false);
        
        // Call error handler if provided
        if (handlersRef.current.onError) {
          handlersRef.current.onError(err);
        }
      });

      socketRef.current.on('disconnect', () => {
        console.log(`Socket disconnected from ${namespace}`);
        setIsConnected(false);
        
        // Call disconnect handler if provided
        if (handlersRef.current.onDisconnect) {
          handlersRef.current.onDisconnect();
        }
      });

      // Handle terminal output if component uses it
      if (handlersRef.current.handleTerminalOutput === true) {
        socketRef.current.on('terminal_output', (data) => {
          if (data && data.data) {
            // If a custom handler is provided, use it
            if (typeof handlersRef.current.handleTerminalOutput === 'function') {
              handlersRef.current.handleTerminalOutput(data.data);
            } else {
              // Default behavior: append to terminal output
              setTerminalOutput(prev => [...prev, data.data]);
            }
          }
        });
      }

      // Register custom event handlers
      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        // Skip special handlers that are handled above
        if (['onConnect', 'onError', 'onDisconnect', 'handleTerminalOutput'].includes(event)) {
          return;
        }
        socketRef.current.on(event, (data) => {
          handler(data, {
            state: stateRef.current,
            updateState,
            setTerminalOutput,
            socket: socketRef.current
          });
        });
      });
    }

    // Cleanup on unmount only
    return () => {
      if (socketRef.current) {
        console.log(`Cleaning up socket connection to ${namespace}`);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [namespace]); // Only depend on namespace

  // Helper function to safely emit events
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
      return true;
    }
    console.warn(`Failed to emit ${event}: Socket not connected`);
    return false;
  }, [isConnected]);

  // Helper function to add one-off event listeners
  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      return () => socketRef.current?.off(event, handler);
    }
    return () => {};
  }, []);

  // Add standard terminal output helpers
  const appendToTerminal = useCallback((message) => {
    setTerminalOutput(prev => [...prev, message]);
  }, []);

  const clearTerminal = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  return {
    // Socket instance and connection state
    socket: socketRef.current,
    isConnected,
    error,
    
    // Event handling
    emit,
    on,
    
    // State management
    state,
    updateState,
    
    // Terminal handling
    terminalOutput,
    setTerminalOutput: appendToTerminal,
    clearTerminalOutput: clearTerminal,
    appendToTerminal,
    clearTerminal
  };
}

export default useSocket; 