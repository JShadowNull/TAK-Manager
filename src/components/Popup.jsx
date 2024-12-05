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
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Popup Content */}
      <div className="bg-cardBg border border-accentBoarder p-6 rounded-lg shadow-lg w-full max-w-2xl relative z-10">
        {/* Popup Title */}
        <h3 className="text-base font-bold mb-4 text-textPrimary">{title}</h3>

        {/* Popup Content Area */}
        <div className="popup-content text-sm overflow-y-auto max-w-full p-2 max-h-96">
          <div className="w-full">
            {children}
          </div>
        </div>

        {/* Terminal Output */}
        {showTerminal && (
          <div 
            ref={terminalRef}
            className="mt-4 bg-primaryBg border border-accentBoarder rounded-lg p-4 h-64 overflow-y-auto text-sm font-mono"
          >
            {terminalOutput.map((line, index) => (
              <div 
                key={index} 
                className="text-textPrimary select-text whitespace-pre-wrap"
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Buttons Area */}
        <div className="flex justify-end mt-6 gap-4">
          {buttons}
        </div>
      </div>
    </div>
  );
}

export default Popup; 