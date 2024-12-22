import { useEffect, useRef } from 'react';
import type { FC, ReactNode } from 'react';
import CustomScrollbar from '../CustomScrollbar';
import Button from '../Button';

interface PopupProps {
  id: string;
  title: string;
  children?: ReactNode;
  isVisible: boolean;
  onClose: () => void;
  buttons?: ReactNode;
  blurSidebar?: boolean;
  variant?: 'standard' | 'terminal';
  showTerminal?: boolean;
  terminalOutput?: Array<string | { data: string }>;
  isInProgress?: boolean;
  isComplete?: boolean;
  isSuccess?: boolean;
  errorMessage?: string | null;
  progressMessage?: string;
  nextStepMessage?: string;
  failureMessage?: string;
  onNext?: () => void;
  onStop?: () => void;
  isStoppingInstallation?: boolean;
}

const Popup: FC<PopupProps> = ({
  id,
  title,
  children,
  isVisible,
  onClose,
  buttons,
  blurSidebar = false,
  variant = 'standard',
  showTerminal = false,
  terminalOutput = [],
  isInProgress = false,
  isComplete = false,
  isSuccess = false,
  errorMessage = null,
  progressMessage = '',
  nextStepMessage = '',
  failureMessage = '',
  onNext,
  onStop,
  isStoppingInstallation
}) => {
  if (!isVisible) return null;

  // Create ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect when terminal output changes
  useEffect(() => {
    if (showTerminal && scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [terminalOutput, showTerminal]);

  const getTerminalButtons = (): ReactNode => {
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

  const getTerminalContent = (): ReactNode => {
    if (isComplete && !showTerminal) {
      return (
        <>
          {isSuccess ? (
            <div className="flex flex-col items-center space-y-1">
              <div className="text-green-500 text-xl">✓</div>
              {nextStepMessage && onNext && (
                <p className="text-sm text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">
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

  const renderTerminalOutput = (): ReactNode => {
    return terminalOutput.map((line, index) => (
      <div key={`${index}-${typeof line === 'object' ? line.data : line}`} className="select-text font-mono text-sm whitespace-pre-wrap">
        {typeof line === 'object' ? line.data : line}
      </div>
    ));
  };

  const terminalContent = showTerminal && (
    <div className="mt-1 bg-background foreground rounded-lg h-64 border text-wrap border-border">
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
        className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} bg-background bg-opacity-50 backdrop-filter backdrop-blur-sm`}
        onClick={() => {
          if (!isInProgress) {
            onClose();
          }
        }}
      />
      
      {/* Popup Content */}
      <div className="bg-card border border-border p-4 rounded-lg shadow-lg max-w-lg w-full relative z-10 mx-4">
        {/* Popup Title */}
        <h3 className="text-lg font-bold mb-4 text-foreground">{title}</h3>

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
};

export default Popup; 