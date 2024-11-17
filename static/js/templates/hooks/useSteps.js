// Hook for step management
function useSteps(initialStep = 1) {
    let currentStep = initialStep;
    const listeners = new Set();
    const stepConfigs = new Map();

    return {
        get current() { return currentStep; },
        next: () => {
            currentStep++;
            listeners.forEach(listener => listener(currentStep));
        },
        prev: () => {
            currentStep--;
            listeners.forEach(listener => listener(currentStep));
        },
        goto: (step) => {
            currentStep = step;
            listeners.forEach(listener => listener(currentStep));
        },
        setConfig: (stepNumber, config) => {
            stepConfigs.set(stepNumber, config);
        },
        getConfig: (stepNumber) => {
            return stepConfigs.get(stepNumber);
        },
        onChange: (callback) => {
            listeners.add(callback);
            return () => listeners.delete(callback);
        }
    };
}

// Make it globally available
window.useSteps = useSteps; 