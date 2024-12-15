import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

function useSocket(namespace, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [operationStatus, setOperationStatus] = useState({
    isInProgress: false,
    isComplete: false,
    isSuccess: false,
    errorMessage: null
  });
  
  const socketRef = useRef(null);

  // Clear terminal output
  const clearTerminalOutput = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  // Reset operation status
  const resetOperationStatus = useCallback(() => {
    setOperationStatus({
      isInProgress: false,
      isComplete: false,
      isSuccess: false,
      errorMessage: null
    });
  }, []);

  // Initialize operation
  const initializeOperation = useCallback(() => {
    clearTerminalOutput();
    setOperationStatus({
      isInProgress: true,
      isComplete: false,
      isSuccess: false,
      errorMessage: null
    });
  }, [clearTerminalOutput]);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(namespace, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...options
    });

    // Connection handlers
    socketRef.current.on('connect', () => {
      console.log(`Socket connected to ${namespace}`);
      setIsConnected(true);
      setError(null);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error(`Socket connection error for ${namespace}:`, err);
      setError(err);
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', () => {
      console.log(`Socket disconnected from ${namespace}`);
      setIsConnected(false);
    });

    // Standard terminal output handler
    socketRef.current.on('terminal_output', (data) => {
      setTerminalOutput(prev => [...prev, data.data]);
    });

    // Standard operation status handlers
    socketRef.current.on('operation_started', () => {
      initializeOperation();
    });

    socketRef.current.on('operation_complete', (data) => {
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: true,
        errorMessage: null
      });
      if (data?.message) {
        setTerminalOutput(prev => [...prev, data.message]);
      }
    });

    socketRef.current.on('operation_failed', (data) => {
      setOperationStatus({
        isInProgress: false,
        isComplete: true,
        isSuccess: false,
        errorMessage: data.error || 'Operation failed'
      });
      if (data?.error) {
        setTerminalOutput(prev => [...prev, `Error: ${data.error}`]);
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log(`Cleaning up socket connection to ${namespace}`);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [namespace, initializeOperation, options]);

  // Helper function to safely emit events
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
      return true;
    }
    return false;
  }, [isConnected]);

  // Helper function to add event listeners
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      return () => socketRef.current?.off(event, callback);
    }
    return () => {};
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    // Terminal-specific returns
    terminalOutput,
    setTerminalOutput,
    clearTerminalOutput,
    operationStatus,
    setOperationStatus,
    resetOperationStatus,
    initializeOperation
  };
}

export default useSocket; 