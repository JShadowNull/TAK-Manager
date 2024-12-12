import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

function useSocket(namespace, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

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

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log(`Cleaning up socket connection to ${namespace}`);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [namespace]);

  // Helper function to safely emit events
  const emit = (event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
      return true;
    }
    return false;
  };

  // Helper function to add event listeners
  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      return () => socketRef.current?.off(event, callback);
    }
    return () => {};
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on
  };
}

export default useSocket; 