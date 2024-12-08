import { io } from 'socket.io-client';

// Create socket connection to backend
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// Add error handling
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Export configured socket instance
export default socket; 