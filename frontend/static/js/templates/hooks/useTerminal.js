// Hook for terminal output management
function useTerminal(terminalId) {
    const terminal = document.getElementById(terminalId);
    
    return {
        append: (text) => {
            if (!terminal) return;
            
            const line = document.createElement('div');
            line.textContent = text;
            line.classList.add('select-text');
            terminal.appendChild(line);
            terminal.scrollTop = terminal.scrollHeight;
        },
        clear: () => {
            if (terminal) terminal.innerHTML = '';
        }
    };
}

// Make it globally available
window.useTerminal = useTerminal; 