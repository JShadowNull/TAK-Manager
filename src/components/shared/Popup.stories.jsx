import Popup from './Popup';
import Button from './Button';

// Generate a large amount of mock terminal output
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
    }
  }
};

// Base configuration for stories
const baseArgs = {
  id: 'story-popup',
  isVisible: true,
  onClose: () => console.log('Close clicked'),
};

// Standard Popup Examples
export const StandardBasic = {
  args: {
    ...baseArgs,
    title: 'Basic Standard Popup',
    children: <p className="p-4 text-textPrimary">This is a basic popup with no buttons.</p>
  }
};

export const StandardWithButtons = {
  args: {
    ...baseArgs,
    title: 'Standard Popup with Buttons',
    children: <p className="p-4 text-textPrimary">This popup has custom action buttons.</p>,
    buttons: (
      <>
        <Button
          variant="danger"
          onClick={() => console.log('Cancel clicked')}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => console.log('Confirm clicked')}
        >
          Confirm
        </Button>
      </>
    )
  }
};

// Terminal Popup Examples
export const TerminalInProgress = {
  args: {
    ...baseArgs,
    title: 'Terminal (In Progress)',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput.slice(0, 20),
    isInProgress: true,
    progressMessage: 'Operation in progress...',
  }
};

export const TerminalWithStop = {
  args: {
    ...baseArgs,
    title: 'Terminal (With Stop Button)',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput.slice(0, 20),
    isInProgress: true,
    progressMessage: 'Long-running operation in progress...',
    onStop: () => console.log('Stop clicked'),
  }
};

export const TerminalSuccess = {
  args: {
    ...baseArgs,
    title: 'Terminal (Success)',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    isInProgress: false,
    isComplete: true,
    isSuccess: true,
    successMessage: 'Operation completed successfully',
  }
};

export const TerminalSuccessWithNext = {
  args: {
    ...baseArgs,
    title: 'Terminal (Success with Next)',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    isInProgress: false,
    isComplete: true,
    isSuccess: true,
    successMessage: 'Operation completed successfully',
    nextStepMessage: 'Click Next to continue',
    onNext: () => console.log('Next clicked'),
  }
};

export const TerminalFailure = {
  args: {
    ...baseArgs,
    title: 'Terminal (Failure)',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: [
      ...mockTerminalOutput.slice(0, 30),
      "ERROR: Operation failed unexpectedly",
      "ERROR: Unable to complete the requested action",
      ...mockTerminalOutput.slice(30, 40).map(line => `DEBUG: ${line}`)
    ],
    isInProgress: false,
    isComplete: true,
    isSuccess: false,
    failureMessage: 'Operation failed',
    errorMessage: 'Unable to complete the requested action',
  }
};

// Special Cases
export const NoTerminalWithMessage = {
  args: {
    ...baseArgs,
    title: 'Message Only',
    variant: 'terminal',
    showTerminal: false,
    isInProgress: true,
    progressMessage: 'Processing your request...',
  }
};

export const FullscreenBlur = {
  args: {
    ...baseArgs,
    title: 'Fullscreen Popup',
    variant: 'terminal',
    showTerminal: true,
    terminalOutput: mockTerminalOutput,
    blurSidebar: true,
    isInProgress: true,
    progressMessage: 'This popup blurs the entire screen',
  }
}; 