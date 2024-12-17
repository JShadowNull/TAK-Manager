import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Singleton store for socket instances
const socketStore = {
  sockets: {},
  subscribers: {},
  getSocket(namespace) {
    if (!this.sockets[namespace]) {
      this.sockets[namespace] = io(`http://127.0.0.1:5000${namespace}`, {
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: false,
        autoConnect: true,
        withCredentials: false
      });
      this.subscribers[namespace] = new Set();
    }
    return this.sockets[namespace];
  },
  subscribe(namespace, subscriber) {
    if (!this.subscribers[namespace]) {
      this.subscribers[namespace] = new Set();
    }
    this.subscribers[namespace].add(subscriber);
  },
  unsubscribe(namespace, subscriber) {
    if (this.subscribers[namespace]) {
      this.subscribers[namespace].delete(subscriber);
      // If no more subscribers, cleanup the socket
      if (this.subscribers[namespace].size === 0) {
        if (this.sockets[namespace]) {
          this.sockets[namespace].removeAllListeners();
          this.sockets[namespace].disconnect();
          delete this.sockets[namespace];
        }
        delete this.subscribers[namespace];
      }
    }
  }
};

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
  
  const subscriberId = useRef(Math.random().toString(36).substr(2, 9));
  const handlersRef = useRef(eventHandlers);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);

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
    const socket = socketStore.getSocket(namespace);
    const subscriber = {
      id: subscriberId.current,
      handlers: handlersRef.current,
      setIsConnected,
      setError,
      updateState,
      appendToTerminal,
      mountedRef
    };

    socketStore.subscribe(namespace, subscriber);

    // Handle connection events
    const onConnect = () => {
      if (mountedRef.current) {
        console.log(`Socket ${namespace} connected successfully`);
        setIsConnected(true);
        setError(null);
        
        // Call connect handler if provided
        if (handlersRef.current.onConnect) {
          handlersRef.current.onConnect(socket);
        }
      }
    };

    const onConnectError = (err) => {
      if (mountedRef.current) {
        console.error(`Socket ${namespace} connection error:`, err);
        setError(err);
        setIsConnected(false);
        
        // Call error handler if provided
        if (handlersRef.current.onError) {
          handlersRef.current.onError(err);
        }
      }
    };

    const onDisconnect = () => {
      if (mountedRef.current) {
        setIsConnected(false);
        
        // Call disconnect handler if provided
        if (handlersRef.current.onDisconnect) {
          handlersRef.current.onDisconnect();
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    // Handle terminal output if component uses it
    if (handlersRef.current.handleTerminalOutput === true) {
      const onTerminalOutput = (data) => {
        if (mountedRef.current) {
          // Handle both string and object data formats
          const outputText = typeof data === 'string' 
            ? data 
            : (data?.data || data?.message || JSON.stringify(data));
          
          if (outputText) {
            appendToTerminal(outputText);
          }
        }
      };
      socket.on('terminal_output', onTerminalOutput);
    }

    // Register custom event handlers
    const customHandlers = {};
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      // Skip special handlers that are handled above
      if (['onConnect', 'onError', 'onDisconnect', 'handleTerminalOutput'].includes(event)) {
        return;
      }
      const boundHandler = (data) => {
        if (mountedRef.current) {
          handler(data, {
            state: stateRef.current,
            updateState,
            appendToTerminal,
            clearTerminal,
            socket
          });
        }
      };
      customHandlers[event] = boundHandler;
      socket.on(event, boundHandler);
    });

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Only cleanup if this is a real unmount, not a React strict mode unmount
      const timeoutId = setTimeout(() => {
        if (!mountedRef.current) {
          socket.off('connect', onConnect);
          socket.off('connect_error', onConnectError);
          socket.off('disconnect', onDisconnect);
          if (handlersRef.current.handleTerminalOutput === true) {
            socket.off('terminal_output');
          }
          Object.entries(customHandlers).forEach(([event, handler]) => {
            socket.off(event, handler);
          });
          socketStore.unsubscribe(namespace, subscriber);
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    };
  }, [namespace, appendToTerminal]); // Only depend on namespace and appendToTerminal

  // Helper function to safely emit events
  const emit = useCallback((event, data) => {
    const socket = socketStore.getSocket(namespace);
    if (socket && socket.connected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }, [namespace]);

  // Helper function to add one-off event listeners
  const on = useCallback((event, handler) => {
    const socket = socketStore.getSocket(namespace);
    if (socket) {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }
    return () => {};
  }, [namespace]);

  return {
    // Socket instance and connection state
    socket: socketStore.getSocket(namespace),
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