import Popup from './Popup';
import Button from '../Button';

// Mock operation function that simulates progress updates from backend
const mockOperation = async (targetId, operationType) => {
  return new Promise((resolve) => {
    // Simulate backend operation_status updates
    const socket = window.socket; // This would be your actual socket instance
    
    // Simulate start
    if (socket) {
      socket.emit('operation_status', {
        operation: operationType,
        status: 'in_progress',
        message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)}ing...`,
        progress: 0
      });

      // Simulate terminal output
      socket.emit('terminal_output', { data: `Starting ${operationType} operation...` });

      // Simulate progress
      setTimeout(() => {
        socket.emit('operation_status', {
          operation: operationType,
          status: 'in_progress',
          message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)}ing... (50%)`,
          progress: 50
        });
        socket.emit('terminal_output', { data: `[INFO] Operation at 50% completion` });
      }, 1000);

      // Simulate completion
      setTimeout(() => {
        socket.emit('operation_status', {
          operation: operationType,
          status: 'complete',
          message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} completed`,
          progress: 100
        });
        socket.emit('terminal_output', { data: `[SUCCESS] Operation completed successfully` });
      }, 2000);
    }

    setTimeout(() => {
      resolve({ success: true });
    }, 2000);
  });
};

// Mock operation that fails
const mockFailedOperation = async (targetId, operationType) => {
  return new Promise((resolve, reject) => {
    const socket = window.socket;
    
    // Simulate start
    if (socket) {
      socket.emit('operation_status', {
        operation: operationType,
        status: 'in_progress',
        message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)}ing...`,
        progress: 0
      });
      socket.emit('terminal_output', { data: `Starting ${operationType} operation...` });

      // Simulate progress before failure
      setTimeout(() => {
        socket.emit('operation_status', {
          operation: operationType,
          status: 'in_progress',
          message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)}ing... (25%)`,
          progress: 25
        });
        socket.emit('terminal_output', { data: `[INFO] Operation at 25% completion` });
        socket.emit('terminal_output', { data: `[WARN] Encountering issues...` });
      }, 1000);

      // Simulate failure
      setTimeout(() => {
        socket.emit('operation_status', {
          operation: operationType,
          status: 'failed',
          message: 'Operation failed unexpectedly',
          error: 'Operation failed unexpectedly'
        });
        socket.emit('terminal_output', { data: `[ERROR] Operation failed: Unexpected error occurred` });
        socket.emit('terminal_output', { data: `[DEBUG] Error details: Connection timeout` });
      }, 2000);
    }

    setTimeout(() => {
      reject(new Error('Operation failed unexpectedly'));
    }, 2000);
  });
};

export default {
  title: 'Shared/Popup',
  component: Popup,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1b1e' }]
    }
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-screen">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: {
      control: 'radio',
      options: ['standard', 'terminal'],
      description: 'The type of popup to display'
    },
    isVisible: {
      control: 'boolean',
      description: 'Controls popup visibility'
    },
    blurSidebar: {
      control: 'boolean',
      description: 'Whether to blur the entire screen or just the main content'
    },
    operationType: {
      control: 'select',
      options: ['start', 'stop', 'restart', 'install', 'uninstall', 'update', 'configure', 'validate'],
      description: 'Type of operation being performed'
    },
    showTerminal: {
      control: 'boolean',
      description: 'Whether to show the terminal output area'
    }
  }
};

// Base configuration for all stories
const baseArgs = {
  id: 'story-popup',
  isVisible: true,
  onClose: () => console.log('Close clicked'),
};

// 1. Standard Popup Variations
export const Standard_Basic = {
  args: {
    ...baseArgs,
    title: 'Basic Standard Popup',
    children: <p className="p-4 text-foreground">Basic popup with no buttons or special configuration.</p>
  }
};

// 2. Terminal Popup with Loader - Progress States
export const Terminal_InProgress = {
  args: {
    ...baseArgs,
    title: 'Terminal - Installation Progress',
    variant: 'terminal',
    showTerminal: true,
    namespace: '/docker-manager',
    operationType: 'install',
    targetId: 'test-container',
    operation: mockOperation,
    onComplete: () => console.log('Operation completed'),
    onError: (error) => console.error('Operation failed:', error)
  }
};

export const Terminal_InProgress_WithStop = {
  args: {
    ...baseArgs,
    title: 'Terminal - Installation Progress with Stop',
    variant: 'terminal',
    showTerminal: true,
    namespace: '/docker-manager',
    operationType: 'install',
    targetId: 'test-container',
    operation: mockOperation,
    onComplete: () => console.log('Operation completed'),
    onError: (error) => console.error('Operation failed:', error),
    onStop: () => console.log('Stop clicked')
  }
};

export const Terminal_Success_WithNext = {
  args: {
    ...baseArgs,
    title: 'Terminal - Success with Next Step',
    variant: 'terminal',
    showTerminal: true,
    namespace: '/docker-manager',
    operationType: 'install',
    targetId: 'test-container',
    operation: mockOperation,
    onComplete: () => console.log('Operation completed'),
    onError: (error) => console.error('Operation failed:', error),
    nextStepMessage: 'Click Next to proceed to configuration',
    onNext: () => console.log('Next clicked')
  }
};

// 4. Terminal Popup - Failure States
export const Terminal_Failure_Basic = {
  args: {
    ...baseArgs,
    title: 'Terminal - Failure with Progress',
    variant: 'terminal',
    showTerminal: true,
    namespace: '/docker-manager',
    operationType: 'install',
    targetId: 'test-container',
    operation: mockFailedOperation,
    onComplete: () => console.log('Operation completed'),
    onError: (error) => console.error('Operation failed:', error),
    failureMessage: 'Installation failed'
  }
}; 