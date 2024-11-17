// Hook for process management
function useProcess() {
    let isProcessing = false;
    let processId = null;
    const listeners = new Set();

    return {
        get isRunning() { return isProcessing; },
        get id() { return processId; },
        start: (id) => {
            isProcessing = true;
            processId = id;
            listeners.forEach(listener => listener({ isProcessing, processId }));
        },
        stop: () => {
            isProcessing = false;
            processId = null;
            listeners.forEach(listener => listener({ isProcessing, processId }));
        },
        onStateChange: (callback) => {
            listeners.add(callback);
            return () => listeners.delete(callback);
        }
    };
}

// Make it globally available
window.useProcess = useProcess; 