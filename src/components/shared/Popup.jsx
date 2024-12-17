import React, { useEffect, useRef } from 'react';
import CustomScrollbar from '../CustomScrollbar';
import Button from './Button';

/*
Usage Examples:

1. Standard Popup - Basic
const [isVisible, setIsVisible] = useState(false);
<Popup
  id="basic-popup"
  title="Basic Popup"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
>
  <p>Basic popup content</p>
</Popup>

2. Standard Popup - With Buttons
<Popup
  id="buttons-popup"
  title="Confirm Action"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  buttons={
    <>
      <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Popup>

3. Standard Popup - Fullscreen Blur
<Popup
  id="fullscreen-popup"
  title="Important Notice"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  blurSidebar={true}
  buttons={
    <Button variant="primary" onClick={handleOk}>OK</Button>
  }
>
  <p>This message appears with full screen blur.</p>
</Popup>

4. Terminal Popup - In Progress
<Popup
  id="terminal-progress"
  title="Installation Progress"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isInProgress={true}
  progressMessage="Installing dependencies..."
  terminalOutput={['Installing package 1...', 'Installing package 2...']}
/>

5. Terminal Popup - In Progress with Stop
<Popup
  id="terminal-with-stop"
  title="Installation Progress"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isInProgress={true}
  progressMessage="Installing dependencies..."
  terminalOutput={terminalLines}
  onStop={handleStop}
  isStoppingInstallation={isStoppingInstallation}
/>

6. Terminal Popup - Success Basic
<Popup
  id="terminal-success"
  title="Installation Complete"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isComplete={true}
  isSuccess={true}
  successMessage="Installation completed successfully"
  terminalOutput={terminalLines}
/>

7. Terminal Popup - Success with Next Step
<Popup
  id="terminal-success-next"
  title="Installation Complete"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isComplete={true}
  isSuccess={true}
  successMessage="Installation completed successfully"
  nextStepMessage="Click Next to configure your installation"
  onNext={handleNext}
  terminalOutput={terminalLines}
/>

8. Terminal Popup - Failure Basic
<Popup
  id="terminal-failure"
  title="Installation Failed"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isComplete={true}
  isSuccess={false}
  failureMessage="Installation failed"
  terminalOutput={[
    'Installing dependencies...',
    'ERROR: Package installation failed'
  ]}
/>

9. Terminal Popup - Failure with Error Details
<Popup
  id="terminal-failure-details"
  title="Installation Failed"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={true}
  isComplete={true}
  isSuccess={false}
  failureMessage="Installation failed"
  errorMessage="Connection timeout: Unable to reach server"
  terminalOutput={[
    'Installing dependencies...',
    'ERROR: Connection timeout',
    'ERROR: Unable to reach server'
  ]}
/>

10. Terminal Popup - No Output Display
<Popup
  id="terminal-no-output"
  title="Processing"
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  variant="terminal"
  showTerminal={false}
  isInProgress={true}
  progressMessage="Processing your request..."
/>

Props Description:
- id: string - Unique identifier for the popup
- title: string - Title displayed at the top of the popup
- isVisible: boolean - Controls popup visibility
- onClose: () => void - Function called when popup is closed
- children: ReactNode - Content for standard popups
- buttons: ReactNode - Custom buttons for standard popups
- blurSidebar: boolean - Whether to blur the entire screen including sidebar
- variant: 'standard' | 'terminal' - Popup type
- showTerminal: boolean - Whether to show terminal output area
- isInProgress: boolean - Shows if operation is in progress
- isComplete: boolean - Shows if operation is complete
- isSuccess: boolean - Shows if operation was successful
- progressMessage: string - Message shown during progress
- successMessage: string - Message shown on success
- failureMessage: string - Message shown on failure
- errorMessage: string - Detailed error message on failure
- nextStepMessage: string - Message prompting next step
- onNext: () => void - Function called when Next is clicked
- onStop: () => void - Function called when Stop is clicked
- isStoppingInstallation: boolean - Shows if stop is in progress
- terminalOutput: string[] | { data: string }[] - Terminal output lines
- terminalRef: React.RefObject - Reference to terminal element
*/

function Popup({ 
  id, 
  title, 
  children,
  isVisible,
  onClose,
  buttons,
  blurSidebar = false,
  // Terminal popup specific props
  variant = 'standard', // 'standard' | 'terminal'
  showTerminal = false,
  terminalOutput = [],
  terminalRef,
  isInProgress = false,
  isComplete = false,
  isSuccess = false,
  errorMessage = null,
  progressMessage = '',
  successMessage = '',
  nextStepMessage = '',
  failureMessage = '',
  onNext,
  onStop,
  isStoppingInstallation
}) {
  if (!isVisible) return null;

  // Create internal ref if none provided for terminal variant
  const internalTerminalRef = useRef(null);
  const actualTerminalRef = terminalRef || internalTerminalRef;
  const scrollContainerRef = useRef(null);

  // Auto-scroll effect when terminal output changes
  useEffect(() => {
    if (showTerminal && scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [terminalOutput, showTerminal]);

  const getTerminalButtons = () => {
    if (isInProgress) {
      if (onStop) {
        return (
          <div className="flex justify-center w-full">
            <Button
              variant="danger"
              onClick={onStop}
              disabled={isStoppingInstallation}
              loading={isStoppingInstallation}
              loadingText="Stopping Installation..."
            >
              Stop Installation
            </Button>
          </div>
        );
      }
      return null;
    }

    if (isComplete) {
      if (onNext) {
        return (
          <div className="flex justify-end w-full">
            <Button
              variant="primary"
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        );
      }
      return (
        <div className="flex justify-end w-full">
          <Button
            variant="primary"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      );
    }

    return null;
  };

  const getTerminalContent = () => {
    if (isComplete && !showTerminal) {
      return (
        <>
          {isSuccess ? (
            <div className="flex flex-col items-center space-y-1">
              <div className="text-green-500 text-xl">✓</div>
              {nextStepMessage && onNext && (
                <p className="text-sm text-gray-300">
                  {nextStepMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <div className="text-red-500 text-xl">✗</div>
              <p className="text-red-500 font-semibold">
                {failureMessage || 'Operation failed'}
              </p>
              {errorMessage && (
                <p className="text-sm text-gray-300">
                  Error: {errorMessage}
                </p>
              )}
            </div>
          )}
        </>
      );
    }

    return (
      <div className="space-y-1">
        <p>
          {progressMessage || 'Operation in progress...'}
        </p>
        {isInProgress && (
          <p className="text-sm text-yellow-400">
            This process may take several minutes.
          </p>
        )}
      </div>
    );
  };

  const renderTerminalOutput = () => {
    return terminalOutput.map((line, index) => (
      <div key={`${index}-${typeof line === 'object' ? line.data : line}`} className="select-text font-mono text-sm whitespace-pre-wrap">
        {typeof line === 'object' ? line.data : line}
      </div>
    ));
  };

  const terminalContent = showTerminal && (
    <div className="mt-1 bg-primaryBg text-white rounded-lg h-64 border text-wrap border-accentBoarder">
      <CustomScrollbar ref={scrollContainerRef}>
        <div className="p-4 break-words">
          {renderTerminalOutput()}
        </div>
      </CustomScrollbar>
    </div>
  );

  return (
    <div 
      id={id} 
      className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} flex items-center justify-center z-50`}
    >
      {/* Background Overlay with Blur Effect */}
      <div 
        className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} bg-black bg-opacity-50 backdrop-filter backdrop-blur-sm`}
        onClick={() => {
          if (!isInProgress) {
            onClose();
          }
        }}
      />
      
      {/* Popup Content */}
      <div className="bg-cardBg border border-accentBoarder p-4 rounded-lg shadow-lg max-w-lg w-full relative z-10 mx-4">
        {/* Popup Title */}
        <h3 className="text-lg font-bold mb-4 text-textPrimary">{title}</h3>

        {/* Popup Content Area */}
        <div className="popup-content text-sm overflow-y-auto max-w-full p-2 max-h-96">
          <div className="w-full space-y-1">
            {variant === 'terminal' ? (
              <>
                <div className="text-center">
                  {getTerminalContent()}
                </div>
                {terminalContent}
              </>
            ) : (
              <div className="space-y-1">
                {children}
              </div>
            )}
          </div>
        </div>

        {/* Buttons Area */}
        <div className="mt-4 w-full">
          {variant === 'terminal' ? getTerminalButtons() : (
            <div className="flex justify-end gap-4">
              {buttons}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Popup; 