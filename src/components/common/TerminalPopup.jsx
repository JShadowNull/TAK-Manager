import React, { useEffect, useRef } from 'react';
import Popup from '../Popup';

const TerminalPopup = ({
  isVisible,
  title,
  showTerminal = true,
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
  onClose,
  onNext,
  onCancel,
  blurSidebar = true
}) => {
  // Create internal ref if none provided
  const internalTerminalRef = useRef(null);
  const actualTerminalRef = terminalRef || internalTerminalRef;

  // Handle terminal scrolling when output changes
  useEffect(() => {
    if (actualTerminalRef.current && terminalOutput.length > 0) {
      actualTerminalRef.current.scrollTop = actualTerminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const getButtons = () => {
    if (isInProgress) {
      if (onCancel) {
        return (
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
            onClick={onCancel}
          >
            Cancel
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

  const getContent = () => {
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
    <Popup
      id="terminal-popup"
      title={title}
      isVisible={isVisible}
      onClose={() => {
        if (!isInProgress) {
          onClose();
        }
      }}
      buttons={getButtons()}
      blurSidebar={blurSidebar}
    >
      <div className="text-center mb-4">
        {getContent()}
      </div>
      {terminalContent}
    </Popup>
  );
};

export default TerminalPopup; 