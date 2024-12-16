import React from 'react';
import Popup from '../shared/Popup';
import Button from '../shared/Button';

function UninstallationPopup({
  isVisible,
  terminalOutput,
  terminalRef,
  isInProgress,
  isComplete,
  isSuccess,
  errorMessage,
  onNext,
  showNextButton
}) {
  return (
    <Popup
      id="uninstall-progress-popup"
      isVisible={isVisible}
      title={isInProgress ? "TAK Server Uninstallation Progress" : "TAK Server Uninstallation Complete"}
      variant="terminal"
      terminalOutput={terminalOutput}
      terminalRef={terminalRef}
      showTerminal={true}
      isInProgress={isInProgress}
      isComplete={isComplete}
      isSuccess={isSuccess}
      errorMessage={errorMessage}
      progressMessage={isInProgress ? 'Uninstalling TAK Server...' : ''}
      onClose={null}
      onNext={showNextButton ? onNext : undefined}
      blurSidebar={true}
    />
  );
}

export default UninstallationPopup; 