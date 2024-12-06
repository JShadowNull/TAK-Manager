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
  onClose,
  blurSidebar = false
}) {
  if (!isVisible) return null;

  return (
    <div 
      id={id} 
      className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} flex items-center justify-center z-50`}
    >
      {/* Background Overlay with Blur Effect */}
      <div 
        className={`fixed ${blurSidebar ? 'inset-0' : 'inset-y-0 right-0 left-64'} bg-black bg-opacity-50 backdrop-filter backdrop-blur-sm`}
        onClick={onClose}
      />
      
      {/* Popup Content */}
      <div className="bg-cardBg border border-accentBoarder p-6 rounded-lg shadow-lg max-w-lg w-full relative z-10 mx-4">
        {/* Popup Title */}
        <h3 className="text-lg font-bold mb-4 text-textPrimary">{title}</h3>

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