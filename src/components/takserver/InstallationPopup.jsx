import React from 'react';
import Popup from '../shared/ui/popups/Popup';
import Button from '../shared/ui/Button';

function InstallationPopup({
  isVisible,
  title,
  terminalOutput,
  terminalRef,
  isInProgress,
  isComplete,
  isSuccess,
  errorMessage,
  progressMessage,
  onNext,
  onStop,
  isStoppingInstallation,
  showNextButton
}) {
  // Determine if stop button should be shown and enabled
  const canStop = isInProgress && !isStoppingInstallation && typeof onStop === 'function';

  return (
    <Popup
      id="installation-progress-popup"
      isVisible={isVisible}
      title={
        isStoppingInstallation 
          ? "Stopping Installation" 
          : isInProgress 
            ? "TAK Server Installation Progress" 
            : "TAK Server Installation Complete"
      }
      variant="terminal"
      terminalOutput={terminalOutput}
      terminalRef={terminalRef}
      showTerminal={true}
      isInProgress={isInProgress || isStoppingInstallation}
      isComplete={isComplete && !isStoppingInstallation}
      isSuccess={isSuccess}
      errorMessage={errorMessage}
      progressMessage={
        isStoppingInstallation 
          ? 'Stopping Installation...'
          : progressMessage || 'Installing TAK Server...'
      }
      onClose={null}
      onNext={showNextButton && !isStoppingInstallation ? onNext : undefined}
      onStop={canStop ? onStop : undefined}
      isStoppingInstallation={isStoppingInstallation}
      blurSidebar={true}
    />
  );
}

export default InstallationPopup; 