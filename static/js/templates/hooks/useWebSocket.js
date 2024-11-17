// Hook for WebSocket management
function useWebSocket(namespace, options = {}) {
    const socket = io(namespace, { transports: ['websocket'], ...options });
    const listeners = new Map();

    return {
        emit: (event, data) => socket.emit(event, data),
        on: (event, callback) => {
            socket.on(event, callback);
            listeners.set(event, callback);
            return () => socket.off(event, callback);
        },
        off: (event) => {
            const callback = listeners.get(event);
            if (callback) {
                socket.off(event, callback);
                listeners.delete(event);
            }
        },
        disconnect: () => socket.disconnect(),
        connect: () => socket.connect()
    };
}

// Make it globally available
window.useWebSocket = useWebSocket; 