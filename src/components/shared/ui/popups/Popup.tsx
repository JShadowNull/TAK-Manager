import { useEffect, useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import CustomScrollbar from '../layout/CustomScrollbar';
import { Button } from '../shadcn/button';
import { Progress } from '../shadcn/progress';
import useSocket, { SocketNamespace } from '../../hooks/useSocket';

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
  namespace?: SocketNamespace;
  onComplete?: () => void;
  onError?: (error: string) => void;
  nextStepMessage?: string;
  failureMessage?: string;
  onNext?: () => void;
  onStop?: () => void;
  isStoppingInstallation?: boolean;
  showNextButton?: boolean;
}

interface SocketState {
  progress: number;
  status: string;
  message: string;
  error: string | null;
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
  namespace,
  onComplete,
  onError,
  nextStepMessage = '',
  failureMessage = '',
  onNext,
  onStop,
  isStoppingInstallation,
  showNextButton
}) => {
  const [showTerminalOutput, setShowTerminalOutput] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize socket with terminal output handling
  const {
    terminalOutput,
    clearTerminal,
    appendToTerminal,
    state
  } = namespace ? useSocket(namespace, {
    initialState: {
      progress: 0,
      status: 'initial',
      message: '',
      error: null
    } as SocketState,
    eventHandlers: {
      handleTerminalOutput: true,
      terminal_output: (data: { data: string }) => {
        appendToTerminal(data.data);
      },
      operation_status: (data: { status: string; progress?: number; error?: string; message?: string; details?: { progress?: number } }, { updateState }) => {
        console.debug('[Popup] Operation status update:', data);
        
        // Get progress from either direct progress field or details
        const progress = data.progress ?? data.details?.progress ?? 0;
        
        updateState({
          progress,
          status: data.status,
          message: data.message || '',
          error: data.error || null
        } as SocketState);

        // Handle completion and error states
        if (data.status === 'complete') {
          onComplete?.();
        } else if (data.status === 'failed' || data.error) {
          onError?.(data.error || 'Operation failed');
        }
      }
    }
  }) : {
    terminalOutput: [],
    clearTerminal: () => {},
    appendToTerminal: () => {},
    state: { progress: 0, status: 'initial', message: '', error: null } as SocketState
  };

  // Set terminal hidden by default
  useEffect(() => {
    if (variant === 'terminal') {
      setShowTerminalOutput(false);
    }
  }, [variant]);

  // Handle terminal cleanup when popup closes
  useEffect(() => {
    if (!isVisible && namespace) {
      clearTerminal();
    }
  }, [isVisible, namespace, clearTerminal]);

  // Auto scroll terminal to bottom
  useEffect(() => {
    if (terminalOutput?.length && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  if (!isVisible) return null;

  const getTerminalContent = (): ReactNode => {
    if (variant !== 'terminal') return null;

    return (
      <div className="space-y-4">
        <div className="text-center">
          {state.message && <p className="mb-2">{state.message}</p>}
          <Progress value={state.progress} className="mb-4" />
        </div>
        {showTerminalOutput && (
          <div className="bg-background foreground rounded-lg h-64 border text-wrap border-border overflow-hidden">
            <CustomScrollbar ref={scrollContainerRef}>
              <div className="p-4 break-words">
                {terminalOutput?.map((line, index) => {
                  const content = typeof line === 'string' ? line : (line as { data: string }).data;
                  return (
                    <div key={index} className="select-text font-mono text-sm whitespace-pre-wrap">
                      {content}
                    </div>
                  );
                })}
              </div>
            </CustomScrollbar>
          </div>
        )}
      </div>
    );
  };

  const getTerminalButtons = (): ReactNode => {
    const buttons = [];
    
    if (variant === 'terminal') {
      buttons.push(
        <Button
          key="toggle-terminal"
          variant="secondary"
          onClick={() => setShowTerminalOutput(!showTerminalOutput)}
        >
          {showTerminalOutput ? 'Hide Terminal' : 'Show Terminal'}
        </Button>
      );
    }

    const isOperationComplete = showNextButton || state.status === 'complete';
    const isOperationInProgress = state.status === 'in_progress';
    const isOperationFailed = state.status === 'failed';

    // Show stop button during in_progress state
    if (isOperationInProgress && onStop) {
      buttons.push(
        <Button
          key="stop"
          variant="danger"
          onClick={onStop}
          disabled={isStoppingInstallation}
          loading={isStoppingInstallation}
          loadingText="Stopping Installation..."
        >
          Stop Installation
        </Button>
      );
    } 
    // Show next/close button on complete or failed states
    else if (isOperationComplete || isOperationFailed) {
      if (onNext) {
        buttons.push(
          <Button
            key="next"
            variant="primary"
            onClick={onNext}
          >
            Next
          </Button>
        );
      } else {
        buttons.push(
          <Button
            key="close"
            variant="primary"
            onClick={onClose}
          >
            Close
          </Button>
        );
      }
    }

    return buttons.length > 0 ? (
      <div className="flex justify-between w-full items-center">
        <div>
          {buttons[0]}
        </div>
        {buttons.length > 1 && (
          <div>
            {buttons.slice(1)}
          </div>
        )}
      </div>
    ) : null;
  };

  return (
    <div 
      id={id} 
      className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} flex items-center justify-center z-50`}
    >
      {/* Background Overlay with Blur Effect */}
      <div 
        className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} bg-background bg-opacity-50 backdrop-filter backdrop-blur-sm`}
        onClick={onClose}
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
                <div>
                  {getTerminalContent()}
                </div>
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