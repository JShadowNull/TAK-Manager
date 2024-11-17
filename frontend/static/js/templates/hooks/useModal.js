// Hook for modal functionality
function useModal(modalId) {
    const modal = document.getElementById(modalId);
    
    return {
        open: () => {
            modal?.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        },
        close: () => {
            modal?.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        },
        toggle: () => {
            modal?.classList.toggle('hidden');
            document.body.classList.toggle('overflow-hidden');
        }
    };
}

// Make it globally available
window.useModal = useModal; 