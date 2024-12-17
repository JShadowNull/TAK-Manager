import Popup from './Popup';
import Button from '../Button';

// Generate mock terminal output for testing
const generateMockOutput = (lines = 50) => {
  const outputs = [];
  for (let i = 1; i <= lines; i++) {
    outputs.push(`[${String(i).padStart(3, '0')}] ${i % 5 === 0 ? 'INFO: ' : ''}Terminal output line ${i}`);
  }
  return outputs;
};

const mockTerminalOutput = generateMockOutput();

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
    isInProgress: {
      control: 'boolean',
      description: 'Shows if an operation is in progress'
    },
    isComplete: {
      control: 'boolean',
      description: 'Shows if an operation is complete'
    },
    isSuccess: {
      control: 'boolean',
      description: 'Shows if the operation was successful'
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

export const Standard_WithButtons = {
  args: {
    ...baseArgs,
    title: 'Standard Popup with Buttons',
    children: <p className="p-4 text-foreground">Popup demonstrating button configurations.</p>,
    buttons: (
      <>
        <Button variant="secondary" onClick={() => console.log('Cancel clicked')}>Cancel</Button>
        <Button variant="primary" onClick={() => console.log('Confirm clicked')}>Confirm</Button>
      </>
    )
  }
};

export const Standard_FullscreenBlur = {
  args: {
    ...baseArgs,
    title: 'Fullscreen Standard Popup',
    children: <p className="p-4 text-foreground">This popup blurs the entire screen including sidebar.</p>,
    blurSidebar: true,
    buttons: (
      <Button variant="primary" onClick={() => console.log('OK clicked')}>OK</Button>
    )
  }
};

// 2. Terminal Popup - Progress States
export const Terminal_InProgress = {
  args: {
    ...baseArgs,
    title: 'Terminal - In Progress',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput.slice(0, 20),
    isInProgress: true,
    progressMessage: 'Installation in progress...',
  }
};

export const Terminal_InProgress_WithStop = {
  args: {
    ...baseArgs,
    title: 'Terminal - In Progress with Stop',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput.slice(0, 20),
    isInProgress: true,
    progressMessage: 'Installation in progress...',
    onStop: () => console.log('Stop clicked'),
  }
};

export const Terminal_InProgress_NoOutput = {
  args: {
    ...baseArgs,
    title: 'Terminal - In Progress (No Output)',
    variant: 'terminal',
    showTerminal: false,
    isInProgress: true,
    progressMessage: 'Processing your request...',
  }
};

// 3. Terminal Popup - Success States
export const Terminal_Success_Basic = {
  args: {
    ...baseArgs,
    title: 'Terminal - Success Basic',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    isInProgress: false,
    isComplete: true,
    isSuccess: true,
    successMessage: 'Operation completed successfully',
  }
};

export const Terminal_Success_WithNext = {
  args: {
    ...baseArgs,
    title: 'Terminal - Success with Next Step',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    isInProgress: false,
    isComplete: true,
    isSuccess: true,
    successMessage: 'Operation completed successfully',
    nextStepMessage: 'Click Next to proceed to configuration',
    onNext: () => console.log('Next clicked'),
  }
};

export const Terminal_Success_NoOutput = {
  args: {
    ...baseArgs,
    title: 'Terminal - Success (No Output)',
    variant: 'terminal',
    showTerminal: false,
    isInProgress: false,
    isComplete: true,
    isSuccess: true,
    successMessage: 'Operation completed successfully',
  }
};

// 4. Terminal Popup - Failure States
export const Terminal_Failure_Basic = {
  args: {
    ...baseArgs,
    title: 'Terminal - Failure Basic',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: [
      ...mockTerminalOutput.slice(0, 15),
      "ERROR: Operation failed unexpectedly",
      ...mockTerminalOutput.slice(15, 20).map(line => `DEBUG: ${line}`)
    ],
    isInProgress: false,
    isComplete: true,
    isSuccess: false,
    failureMessage: 'Operation failed',
  }
};

export const Terminal_Failure_WithError = {
  args: {
    ...baseArgs,
    title: 'Terminal - Failure with Error Details',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: [
      ...mockTerminalOutput.slice(0, 15),
      "ERROR: Connection timeout",
      "ERROR: Unable to reach server",
      ...mockTerminalOutput.slice(15, 20).map(line => `DEBUG: ${line}`)
    ],
    isInProgress: false,
    isComplete: true,
    isSuccess: false,
    failureMessage: 'Installation failed',
    errorMessage: 'Connection timeout: Unable to reach server',
  }
};

export const Terminal_Failure_NoOutput = {
  args: {
    ...baseArgs,
    title: 'Terminal - Failure (No Output)',
    variant: 'terminal',
    showTerminal: false,
    isInProgress: false,
    isComplete: true,
    isSuccess: false,
    failureMessage: 'Operation failed',
    errorMessage: 'An unexpected error occurred',
  }
};

// 5. Special Configurations
export const Special_LoadingState = {
  args: {
    ...baseArgs,
    title: 'Special - Loading State',
    variant: 'terminal',
    showTerminal: true,
    isInProgress: true,
    progressMessage: 'Loading...',
    isStoppingInstallation: true,
    onStop: () => console.log('Stop clicked'),
  }
};

export const Special_FullscreenTerminal = {
  args: {
    ...baseArgs,
    title: 'Special - Fullscreen Terminal',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    blurSidebar: true,
    isInProgress: true,
    progressMessage: 'This terminal popup blurs the entire screen',
  }
}; 