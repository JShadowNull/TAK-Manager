import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Generic Socket.IO hook for handling WebSocket connections
 * @param {string} namespace - Socket namespace to connect to
 * @param {Object} options - Configuration options
 * @param {Object} eventHandlers - Map of event names to their handlers
 * @param {Object} initialState - Initial state for any custom states needed
 * @param {Object} socketRef - Reference to the socket instance
 * @returns {Object} Socket instance and utility functions
 */
function useSocket(namespace, {
  eventHandlers = {},
  initialState = {},
  socketRef = null,
  ...options
} = {}) {
  // Basic socket states
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [state, setState] = useState(initialState);
  const [terminalOutput, setTerminalOutput] = useState([]);
  
  const internalSocketRef = useRef(null);
  const handlersRef = useRef(eventHandlers);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);

  // Use the provided socketRef if available, otherwise use internal one
  const activeSocketRef = socketRef || internalSocketRef;

  // Update refs when props change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clear terminal output
  const clearTerminal = useCallback(() => {
    if (mountedRef.current) {
      setTerminalOutput([]);
    }
  }, []);

  // Update state partially
  const updateState = useCallback((updates) => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        ...updates
      }));
    }
  }, []);

  // Append to terminal output
  const appendToTerminal = useCallback((message) => {
    if (message && mountedRef.current) {
      setTerminalOutput(prev => [...prev, message]);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    mountedRef.current = true;

    // Only create socket if it doesn't exist
    if (!activeSocketRef.current) {
      activeSocketRef.current = io(`http://127.0.0.1:5000${namespace}`, {
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
        autoConnect: true,
        withCredentials: false,
        ...options
      });

      // Handle connection events
      activeSocketRef.current.on('connect', () => {
        if (mountedRef.current) {
          console.log('Socket connected successfully');
          setIsConnected(true);
          setError(null);
          
          // Call connect handler if provided
          if (handlersRef.current.onConnect) {
            handlersRef.current.onConnect(activeSocketRef.current);
          }
        }
      });

      activeSocketRef.current.on('connect_error', (err) => {
        if (mountedRef.current) {
          console.error('Socket connection error:', err);
          setError(err);
          setIsConnected(false);
          
          // Call error handler if provided
          if (handlersRef.current.onError) {
            handlersRef.current.onError(err);
          }
        }
      });

      activeSocketRef.current.on('disconnect', () => {
        if (mountedRef.current) {
          setIsConnected(false);
          
          // Call disconnect handler if provided
          if (handlersRef.current.onDisconnect) {
            handlersRef.current.onDisconnect();
          }
        }
      });

      // Handle terminal output if component uses it
      if (handlersRef.current.handleTerminalOutput === true) {
        activeSocketRef.current.on('terminal_output', (data) => {
          if (mountedRef.current) {
            // Handle both string and object data formats
            const outputText = typeof data === 'string' 
              ? data 
              : (data?.data || data?.message || JSON.stringify(data));
            
            if (outputText) {
              appendToTerminal(outputText);
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
        activeSocketRef.current.on(event, (data) => {
          if (mountedRef.current) {
            handler(data, {
              state: stateRef.current,
              updateState,
              appendToTerminal,
              clearTerminal,
              socket: activeSocketRef.current
            });
          }
        });
      });
    }

    // Cleanup on unmount only
    return () => {
      mountedRef.current = false;
      
      // Only cleanup if this is a real unmount, not a React strict mode unmount
      const timeoutId = setTimeout(() => {
        if (!mountedRef.current && activeSocketRef.current) {
          activeSocketRef.current.removeAllListeners();
          activeSocketRef.current.disconnect();
          activeSocketRef.current = null;
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    };
  }, [namespace, options, appendToTerminal]); // Only depend on namespace and options

  // Helper function to safely emit events
  const emit = useCallback((event, data) => {
    if (activeSocketRef.current && isConnected) {
      activeSocketRef.current.emit(event, data);
      return true;
    }
    return false;
  }, [isConnected]);

  // Helper function to add one-off event listeners
  const on = useCallback((event, handler) => {
    if (activeSocketRef.current) {
      activeSocketRef.current.on(event, handler);
      return () => activeSocketRef.current?.off(event, handler);
    }
    return () => {};
  }, []);

  return {
    // Socket instance and connection state
    socket: activeSocketRef.current,
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
    appendToTerminal,
    clearTerminal,
    setTerminalOutput
  };
}

export default useSocket; 