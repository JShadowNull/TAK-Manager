import { useEffect, useState, useRef } from 'react';
import type { FC, ReactNode } from 'react';
import { Button } from '../shadcn/button';
import { Progress } from '../shadcn/progress';
import { ScrollArea } from '../shadcn/scroll-area';
import useSocket, { type SocketNamespace } from '../../hooks/useSocket';

interface PopupProps {
  id: string;
  title: string;
  isVisible: boolean;
  onClose: () => void;
  variant: "standard" | "terminal";
  blurSidebar?: boolean;
  buttons?: React.ReactNode;
  children?: React.ReactNode;
  namespace?: SocketNamespace;
  operationType?: string;
  targetId?: string;
  operation?: () => Promise<{ success: boolean }>;
  onComplete?: () => void;
  onError?: (error: string) => void;
  nextStepMessage?: string;
  failureMessage?: string;
  onNext?: () => void;
  showNextButton?: boolean;
  onStop?: () => void;
  isStoppingInstallation?: boolean;
  terminalOutput?: string[];
  isInProgress?: boolean;
  isComplete?: boolean;
  isSuccess?: boolean;
  errorMessage?: string;
  progressMessage?: string;
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
  namespace,
  onError,
  onNext,
  onStop,
  isStoppingInstallation
}) => {
  const [showTerminalOutput, setShowTerminalOutput] = useState(false);
  const userHidTerminal = useRef(false);

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
        // Only show terminal if user hasn't explicitly hidden it
        if (!userHidTerminal.current) {
          setShowTerminalOutput(true);
        }
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

        // Only handle error states automatically
        if (data.status === 'failed' || data.error) {
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

  // Set terminal visible when we have output (only if user hasn't hidden it)
  useEffect(() => {
    if (variant === 'terminal' && terminalOutput.length > 0 && !userHidTerminal.current) {
      setShowTerminalOutput(true);
    }
  }, [variant, terminalOutput]);

  // Handle terminal cleanup when popup closes
  useEffect(() => {
    if (!isVisible && namespace) {
      clearTerminal();
      setShowTerminalOutput(false);
      userHidTerminal.current = false;
    }
  }, [isVisible, namespace, clearTerminal]);

  const handleToggleTerminal = () => {
    const newState = !showTerminalOutput;
    setShowTerminalOutput(newState);
    userHidTerminal.current = !newState;
  };

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
            <ScrollArea className="h-full" autoScroll content={terminalOutput}>
              <div className="p-4 break-words">
                {terminalOutput?.map((line, index) => {
                  const content = typeof line === 'string' ? line : (line as { data: string }).data;
                  return (
                    <div 
                      key={`${index}-${content}`} 
                      className="select-text font-mono text-sm whitespace-pre-wrap break-all"
                      style={{ overflowWrap: 'break-word', wordBreak: 'break-all' }}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  const getTerminalButtons = (): ReactNode => {
    if (variant !== 'terminal') return null;

    const isComplete = state.status === 'complete';

    return (
      <div className="flex justify-between items-center mt-4">
        <Button
          variant="outline"
          onClick={handleToggleTerminal}
        >
          {showTerminalOutput ? 'Hide Terminal' : 'Show Terminal'}
        </Button>
        <div className="flex gap-2">
          {!isComplete && onStop && (
            <Button
              variant="danger"
              onClick={onStop}
              disabled={isStoppingInstallation}
            >
              {isStoppingInstallation ? 'Stopping...' : 'Stop'}
            </Button>
          )}
          {isComplete && (
            <Button onClick={onNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      id={id} 
      className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} flex items-center justify-center z-50`}
    >
      {/* Background Overlay with Blur Effect */}
      <div 
        className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} bg-opacity-50 backdrop-filter backdrop-blur-sm`}
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