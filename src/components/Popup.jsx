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
  onStop
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
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200 flex items-center gap-2"
            onClick={onStop}
          >
            <span className="material-icons text-sm">stop_circle</span>
            Stop
          </button>
        );
      }
      return (
        <div className="text-sm text-gray-400">
          Operation in progress...
        </div>
      );
    }

    if (isComplete) {
      if (onNext) {
        return (
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
            onClick={onNext}
          >
            Next
          </button>
        );
      }
      return (
        <button
          className={`text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor 
            hover:text-black hover:shadow-md hover:border-black 
            ${isSuccess ? 'hover:bg-green-500' : 'hover:bg-red-500'} 
            transition-all duration-200`}
          onClick={onClose}
        >
          Close
        </button>
      );
    }

    return null;
  };

  const getTerminalContent = () => {
    if (isComplete) {
      return (
        <>
          {isSuccess ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-green-500 text-xl">✓</div>
              <p className="text-green-500 font-semibold">
                {successMessage || 'Operation completed successfully'}
              </p>
              {nextStepMessage && onNext && (
                <p className="text-sm text-gray-300 mt-2">
                  {nextStepMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
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
      <>
        <p>
          {progressMessage || 'Operation in progress...'}
        </p>
        {isInProgress && (
          <p className="text-sm text-yellow-400">
            This process may take several minutes.
          </p>
        )}
      </>
    );
  };

  const renderTerminalOutput = () => {
    return terminalOutput.map((line, index) => (
      <div key={`${index}-${line}`} className="select-text font-mono text-sm whitespace-pre-wrap">
        {line}
      </div>
    ));
  };

  const terminalContent = showTerminal && !isComplete && (
    <div 
      ref={actualTerminalRef}
      className="mt-4 bg-black text-white p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm"
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
      <div className="bg-cardBg border border-accentBoarder p-6 rounded-lg shadow-lg max-w-lg w-full relative z-10 mx-4">
        {/* Popup Title */}
        <h3 className="text-lg font-bold mb-4 text-textPrimary">{title}</h3>

        {/* Popup Content Area */}
        <div className="popup-content text-sm overflow-y-auto max-w-full p-2 max-h-96">
          <div className="w-full">
            {variant === 'terminal' ? (
              <>
                <div className="text-center mb-4">
                  {getTerminalContent()}
                </div>
                {terminalContent}
              </>
            ) : (
              children
            )}
          </div>
        </div>

        {/* Buttons Area */}
        <div className="flex justify-center mt-6 gap-4">
          {variant === 'terminal' ? getTerminalButtons() : buttons}
        </div>
      </div>
    </div>
  );
}

export default Popup; 