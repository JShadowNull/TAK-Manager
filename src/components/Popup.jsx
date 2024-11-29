import React from 'react';

function Popup({ 
  id, 
  title, 
  children, 
  showTerminal = false, 
  terminalOutput, 
  terminalRef,
  isVisible, 
  buttons,
  onClose 
}) {
  if (!isVisible) return null;

  return (
    <div 
      id={id} 
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      {/* Background Overlay with Blur Effect */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-filter backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Popup Content */}
      <div className="bg-cardBg border-1 border-accentBoarder p-6 rounded-lg shadow-lg max-w-lg w-full text-white relative z-10 flex flex-col items-center">
        {/* Popup Title */}
        <h3 className="text-lg mb-4 text-center">{title}</h3>

        {/* Popup Content Area */}
        <div className="popup-content text-sm overflow-y-auto max-w-full p-2 max-h-96 flex-grow flex justify-center items-start">
          <div className="w-full max-w-lg">
            {children}
          </div>
        </div>

        {/* Terminal Output */}
        {showTerminal && (
          <div 
            ref={terminalRef}
            className="list-none space-y-2 overflow-y-auto text-textSecondary text-sm border border-accentBoarder h-64 p-2 rounded-lg mt-4 w-full"
          >
            {terminalOutput.map((line, index) => (
              <div key={index} className="select-text">{line}</div>
            ))}
          </div>
        )}

        {/* Buttons Area */}
        <div className="flex justify-center mt-4 space-x-2 w-full">
          <div className="flex justify-center space-x-2 w-full">
            {buttons}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Popup; 