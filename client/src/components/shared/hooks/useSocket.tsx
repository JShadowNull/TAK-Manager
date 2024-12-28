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

// Define all backend socket events
export const BACKEND_EVENTS = {
  DOCKER_MANAGER: {
    namespace: '/docker-manager',
    events: {
      STATUS_UPDATE: 'docker_status',
      CONTAINER_OPERATION: 'container_operation',
      DOCKER_OPERATION: 'docker_operation',
      CONTAINERS_LIST: 'containers'
    }
  },
  TAKSERVER_STATUS: {
    namespace: '/takserver-status',
    events: {
      STATUS_UPDATE: 'takserver_status'
    }
  },
  TAKSERVER_UNINSTALL: {
    namespace: '/takserver-uninstall',
    events: {
      STATUS_UPDATE: 'uninstall_status',
      COMPLETE: 'uninstall_complete'
    }
  },
  TAKSERVER_INSTALLER: {
    namespace: '/takserver-installer',
    events: {
      DOCKER_STATUS: 'docker_installed_status'
    }
  }
} as const;

export type SocketNamespace = typeof SOCKET_NAMESPACES[number];
export type BackendEvents = typeof BACKEND_EVENTS;

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
    socket: Socket | undefined;
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

export type UseSocketReturn = {
  socket: Socket | undefined;
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

// Socket store implementation
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
        // Request initial state on connect/reconnect
        socket.emit('request_initial_state');
        this.notifySubscribers(namespace, 'connect', socket);
      });

      socket.on('connect_error', (error) => {
        console.error(`Socket ${namespace} connection error:`, error);
        this.notifySubscribers(namespace, 'error', error);
      });

      socket.on('disconnect', () => {
        console.log(`Socket ${namespace} disconnected`);
        this.notifySubscribers(namespace, 'disconnect');
      });

      // Handle initial state response
      socket.on('initial_state', (state: any) => {
        if (state && typeof state === 'object') {
          this.updateSharedState(namespace, state);
        }
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
              if (subscriber.handlers.onConnect) {
                subscriber.handlers.onConnect(this.sockets[namespace]);
              }
              break;
            case 'disconnect':
              subscriber.setIsConnected(false);
              if (subscriber.handlers.onDisconnect) {
                subscriber.handlers.onDisconnect();
              }
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
    
    const socket = this.sockets[namespace];
    
    // Set up event handlers for this subscriber
    if (socket) {
      // Set up custom event handlers from the subscriber
      Object.entries(subscriber.handlers).forEach(([event, handler]) => {
        if (['onConnect', 'onError', 'onDisconnect', 'handleTerminalOutput'].includes(event)) {
          return;
        }
        if (typeof handler === 'function') {
          socket.on(event, (data: any) => {
            if (subscriber.mountedRef.current) {
              // Update the shared state first
              if (data && typeof data === 'object') {
                this.updateSharedState(namespace, data);
              }
              
              // Then call the handler with the complete state
              handler(data, {
                state: this.states[namespace],
                updateState: (updates: any) => {
                  const newState = {
                    ...this.states[namespace],
                    ...updates
                  };
                  this.updateSharedState(namespace, newState);
                },
                appendToTerminal: subscriber.appendToTerminal,
                clearTerminal: () => {},
                socket
              });
            }
          });
        }
      });
    }
    
    // If socket is connected, notify subscriber and request initial state
    if (socket?.connected) {
      subscriber.setIsConnected(true);
      if (subscriber.handlers.onConnect) {
        subscriber.handlers.onConnect(socket);
      }
      
      // Request initial state from the backend
      socket.emit('request_initial_state');
    }
    
    // Always provide the current state to new subscribers, even if it's partial
    if (this.states[namespace] && Object.keys(this.states[namespace]).length > 0) {
      subscriber.updateState(this.states[namespace]);
    }
  },

  updateSharedState(namespace: SocketNamespace, updates: any): void {
    if (!this.states[namespace]) {
      this.states[namespace] = {};
    }

    // Only update if there are actual changes
    const hasChanges = Object.entries(updates).some(
      ([key, value]) => JSON.stringify(this.states[namespace][key]) !== JSON.stringify(value)
    );

    if (hasChanges) {
      this.states[namespace] = {
        ...this.states[namespace],
        ...updates
      };

      // Notify subscribers with complete state
      this.subscribers[namespace]?.forEach(subscriber => {
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
  },

  unsubscribe(namespace: SocketNamespace, subscriber: Subscriber): void {
    if (this.subscribers[namespace]) {
      this.subscribers[namespace].delete(subscriber);
      
      // Clean up socket event listeners for this subscriber
      const socket = this.sockets[namespace];
      if (socket) {
        Object.entries(subscriber.handlers).forEach(([event, handler]) => {
          if (typeof handler === 'function' && !['onConnect', 'onError', 'onDisconnect', 'handleTerminalOutput'].includes(event)) {
            socket.off(event);
          }
        });
      }
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

  // Append to terminal output
  const appendToTerminal = useCallback((message: string) => {
    if (message && mountedRef.current) {
      setTerminalOutput(prev => [...prev, message]);
    }
  }, []);

  // Set up socket subscription
  useEffect(() => {
    mountedRef.current = true;
    
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

    try {
      socketStore.subscribe(namespace, subscriber);
    } catch (err) {
      console.error(`Failed to subscribe to ${namespace}:`, err);
      setError(err as Error);
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