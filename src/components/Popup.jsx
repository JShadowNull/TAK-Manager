import React, { useEffect, useRef } from 'react';

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

  // Handle terminal scrolling when output changes
  useEffect(() => {
    if (variant === 'terminal' && actualTerminalRef.current && terminalOutput.length > 0) {
      actualTerminalRef.current.scrollTop = actualTerminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const getTerminalButtons = () => {
    if (isInProgress) {
      if (onStop) {
        return (
          <div className="flex justify-center w-full">
            <button
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
              onClick={onStop}
              disabled={isStoppingInstallation}
            >
              {isStoppingInstallation ? 'Stopping...' : 'Stop'}
            </button>
          </div>
        );
      }
      return null;
    }

    if (isComplete) {
      if (onNext) {
        return (
          <div className="flex justify-end w-full">
            <button
              className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={onNext}
            >
              Next
            </button>
          </div>
        );
      }
      return (
        <div className="flex justify-end w-full">
          <button
            className="text-buttonTextColor rounded-lg px-4 py-2 text-sm border border-buttonBorder bg-buttonColor 
              hover:text-black hover:shadow-md hover:accentBoarder hover:bg-red-500
              transition-all duration-200"
            onClick={onClose}
          >
            Close
          </button>
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

    if (!showTerminal) {
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
    }

    return null;
  };

  const renderTerminalOutput = () => {
    return terminalOutput.map((line, index) => (
      <div key={`${index}-${line}`} className="select-text font-mono text-sm whitespace-pre-wrap">
        {line}
      </div>
    ));
  };

  const terminalContent = showTerminal && (
    <div 
      ref={actualTerminalRef}
      className="mt-1 bg-primaryBg text-white p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm border border-accentBoarder"
    >
      {renderTerminalOutput()}
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