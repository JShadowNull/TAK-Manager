import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket, io } from 'socket.io-client';

// Define all socket namespaces
const SOCKET_NAMESPACES = [
  '/docker-manager',
  '/takserver-status',
  '/takserver-installer',
  '/takserver-uninstall',
  '/ota-update',
  '/ip-fetcher',
  '/services-monitor',
  '/cert-manager'
] as const;

export type SocketNamespace = typeof SOCKET_NAMESPACES[number];

// Type definitions
type Subscriber = {
  id: string;
  handlers: EventHandlers;
  setIsConnected: (connected: boolean) => void;
  setError: (error: Error | null) => void;
  updateState: (updates: any) => void;
  appendToTerminal: (message: string) => void;
  mountedRef: React.MutableRefObject<boolean>;
};

type SocketStore = {
  sockets: { [key: string]: Socket };
  subscribers: { [key: string]: Set<Subscriber> };
  states: { [key: string]: any };
  isInitialized: boolean;
  
  initialize(): void;
  getSocket(namespace: SocketNamespace): Socket;
  subscribe: (namespace: SocketNamespace, subscriber: Subscriber) => void;
  unsubscribe: (namespace: SocketNamespace, subscriber: Subscriber) => void;
  updateSharedState: (namespace: SocketNamespace, updates: any) => void;
  notifySubscribers: (namespace: SocketNamespace, event: string, data?: any) => void;
  cleanup(): void;
  safelyAddListener(socket: Socket | undefined, event: string, handler: (...args: any[]) => void): void;
};

type EventHandler = (
  data: any,
  helpers: {
    state: any;
    updateState: (updates: any) => void;
    appendToTerminal: (message: string) => void;
    clearTerminal: () => void;
    socket: Socket;
  }
) => void;

type EventHandlers = {
  [key: string]: EventHandler | ((socket: Socket) => void) | ((error: Error) => void) | (() => void) | boolean | undefined;
  onConnect?: (socket: Socket) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
  handleTerminalOutput?: boolean;
};

type UseSocketOptions = {
  eventHandlers?: EventHandlers;
  initialState?: any;
};

type UseSocketReturn = {
  socket: Socket;
  isConnected: boolean;
  error: Error | null;
  emit: (event: string, data?: any) => boolean;
  on: (event: string, handler: (data: any) => void) => () => void;
  state: any;
  updateState: (updates: any) => void;
  terminalOutput: string[];
  appendToTerminal: (message: string) => void;
  clearTerminal: () => void;
  setTerminalOutput: React.Dispatch<React.SetStateAction<string[]>>;
};

// Enhanced socket store with initialization
const socketStore: SocketStore = {
  sockets: {},
  subscribers: {},
  states: {},
  isInitialized: false,

  initialize() {
    if (this.isInitialized) return;

    // Initialize all sockets immediately
    SOCKET_NAMESPACES.forEach(namespace => {
      const socket = io(`http://127.0.0.1:5000${namespace}`, {
        transports: ['websocket'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        timeout: 5000,
        forceNew: false,
        autoConnect: true,
        withCredentials: false
      });

      // Set up basic event handlers for each socket
      socket.on('connect', () => {
        console.log(`Socket ${namespace} connected`);
        // Request initial state from backend
        socket.emit('check_status');
        this.notifySubscribers(namespace, 'connect');
      });

      socket.on('connect_error', (error) => {
        console.error(`Socket ${namespace} connection error:`, error);
        this.notifySubscribers(namespace, 'error', error);
      });

      socket.on('disconnect', () => {
        console.log(`Socket ${namespace} disconnected`);
        this.notifySubscribers(namespace, 'disconnect');
      });

      this.sockets[namespace] = socket;
      this.subscribers[namespace] = new Set();
      
      // Initialize persistent state storage for each namespace
      if (!this.states[namespace]) {
        this.states[namespace] = {};
      }
    });

    // Set up global cleanup
    window.addEventListener('beforeunload', this.cleanup.bind(this));
    
    this.isInitialized = true;
  },

  getSocket(namespace: SocketNamespace): Socket {
    if (!this.isInitialized) {
      this.initialize();
    }
    if (!this.sockets[namespace]) {
      console.error(`Socket for namespace ${namespace} not found`);
      throw new Error(`Socket for namespace ${namespace} not found`);
    }
    return this.sockets[namespace];
  },

  notifySubscribers(namespace: SocketNamespace, event: string, data?: any) {
    if (this.subscribers[namespace]) {
      this.subscribers[namespace].forEach(subscriber => {
        if (subscriber.mountedRef.current) {
          switch (event) {
            case 'error':
              subscriber.setError(data);
              break;
            case 'connect':
              subscriber.setIsConnected(true);
              subscriber.setError(null);
              break;
            case 'disconnect':
              subscriber.setIsConnected(false);
              break;
          }
        }
      });
    }
  },

  subscribe(namespace: SocketNamespace, subscriber: Subscriber): void {
    if (!this.subscribers[namespace]) {
      this.subscribers[namespace] = new Set();
    }
    this.subscribers[namespace].add(subscriber);
    
    // Get the current socket
    const socket = this.sockets[namespace];
    
    // If we have existing state, update the subscriber immediately
    if (Object.keys(this.states[namespace] || {}).length > 0) {
      subscriber.updateState(this.states[namespace]);
    }
    
    // If socket is connected but we don't have state, request it
    if (socket?.connected && Object.keys(this.states[namespace] || {}).length === 0) {
      socket.emit('check_status');
    }
    
    // Update connection status
    if (socket?.connected) {
      subscriber.setIsConnected(true);
    }
  },

  unsubscribe(namespace: SocketNamespace, subscriber: Subscriber): void {
    if (this.subscribers[namespace]) {
      this.subscribers[namespace].delete(subscriber);
    }
  },

  updateSharedState(namespace: SocketNamespace, updates: any): void {
    // Ensure we have a state object for this namespace
    if (!this.states[namespace]) {
      this.states[namespace] = {};
    }

    // Merge updates with existing state, preserving all existing data
    // unless explicitly overwritten by the updates
    this.states[namespace] = {
      ...this.states[namespace],
      ...updates
    };

    // Notify all subscribers with the complete state
    if (this.subscribers[namespace]) {
      this.subscribers[namespace].forEach(subscriber => {
        if (subscriber.mountedRef.current) {
          subscriber.updateState(this.states[namespace]);
        }
      });
    }
  },

  cleanup(): void {
    Object.entries(this.sockets).forEach(([namespace, socket]) => {
      console.log(`Cleaning up socket for namespace: ${namespace}`);
      socket.removeAllListeners();
      socket.close();
    });
    this.sockets = {};
    this.subscribers = {};
    this.states = {};
    this.isInitialized = false;
  },

  safelyAddListener(socket: Socket | undefined, event: string, handler: (...args: any[]) => void): void {
    if (!socket) {
      console.warn(`Cannot add listener for ${event} - socket undefined`);
      return;
    }

    const addListener = () => {
      socket.on(event, handler);
    };

    if (socket.connected) {
      addListener();
    } else {
      // Add listener once connected
      const connectHandler = () => {
        addListener();
        socket.off('connect', connectHandler);
      };
      socket.on('connect', connectHandler);
    }
  }
};

// Initialize sockets immediately
socketStore.initialize();

/**
 * Generic Socket.IO hook for handling WebSocket connections
 * @param namespace - Socket namespace to connect to
 * @param options - Configuration options
 * @returns Socket instance and utility functions
 */
function useSocket(
  namespace: SocketNamespace,
  {
    eventHandlers = {},
    initialState = {}
  }: UseSocketOptions = {}
): UseSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<any>(initialState);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  
  const subscriberId = useRef(Math.random().toString(36).substr(2, 9));
  const handlersRef = useRef<EventHandlers>(eventHandlers);
  const mountedRef = useRef(true);

  // Update handlers ref when props change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  // Clear terminal output
  const clearTerminal = useCallback(() => {
    if (mountedRef.current) {
      setTerminalOutput([]);
    }
  }, []);

  // Update state partially
  const updateState = useCallback((updates: any) => {
    if (mountedRef.current) {
      setState((prev: Record<string, any>) => ({
        ...prev,
        ...updates
      }));
    }
  }, []);

  // Append to terminal output
  const appendToTerminal = useCallback((message: string) => {
    if (message && mountedRef.current) {
      setTerminalOutput(prev => [...prev, message]);
    }
  }, []);

  // Set up socket subscription
  useEffect(() => {
    mountedRef.current = true;
    let socket: Socket | undefined;
    
    try {
      socket = socketStore.getSocket(namespace);
      
      // Initialize the shared state with the component's initial state
      if (Object.keys(initialState).length > 0) {
        socketStore.updateSharedState(namespace, initialState);
      }
      
    } catch (err) {
      console.error(`Failed to get socket for ${namespace}:`, err);
      setError(err as Error);
      return;
    }

    const subscriber: Subscriber = {
      id: subscriberId.current,
      handlers: handlersRef.current,
      setIsConnected,
      setError,
      updateState: (newState: any) => {
        if (mountedRef.current) {
          setState(newState);
        }
      },
      appendToTerminal,
      mountedRef
    };

    socketStore.subscribe(namespace, subscriber);

    // Set up custom event handlers
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      if (['onConnect', 'onError', 'onDisconnect', 'handleTerminalOutput'].includes(event)) {
        return;
      }
      if (typeof handler === 'function' && socket) {
        socketStore.safelyAddListener(socket, event, (data: any) => {
          if (mountedRef.current) {
            handler(data, {
              state: socketStore.states[namespace],
              updateState: (updates: any) => socketStore.updateSharedState(namespace, updates),
              appendToTerminal,
              clearTerminal,
              socket
            });
          }
        });
      }
    });

    // Handle terminal output
    if (handlersRef.current.handleTerminalOutput && socket) {
      socketStore.safelyAddListener(socket, 'terminal_output', (data: any) => {
        if (mountedRef.current) {
          const outputText = typeof data === 'string' 
            ? data 
            : (data?.data || data?.message || JSON.stringify(data));
          if (outputText) {
            appendToTerminal(outputText);
          }
        }
      });
    }

    return () => {
      mountedRef.current = false;
      socketStore.unsubscribe(namespace, subscriber);
    };
  }, [namespace, appendToTerminal]);

  // Helper function to safely emit events
  const emit = useCallback((event: string, data?: any): boolean => {
    try {
      const socket = socketStore.getSocket(namespace);
      if (socket?.connected) {
        socket.emit(event, data);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to emit ${event}:`, err);
      return false;
    }
  }, [namespace]);

  // Helper function to add one-off event listeners
  const on = useCallback((event: string, handler: (data: any) => void) => {
    try {
      const socket = socketStore.getSocket(namespace);
      if (socket) {
        socketStore.safelyAddListener(socket, event, handler);
        return () => socket.off(event, handler);
      }
      return () => {};
    } catch (err) {
      console.error(`Failed to add listener for ${event}:`, err);
      return () => {};
    }
  }, [namespace]);

  return {
    socket: socketStore.getSocket(namespace),
    isConnected,
    error,
    emit,
    on,
    state,
    updateState: (updates: any) => socketStore.updateSharedState(namespace, updates),
    terminalOutput,
    appendToTerminal,
    clearTerminal,
    setTerminalOutput
  };
}

export default useSocket; 