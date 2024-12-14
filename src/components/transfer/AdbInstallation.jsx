import React, { useEffect } from 'react';
import Popup from '../Popup';
import Button from '../shared/Button';

function AdbInstallation({
  adbInstallation,
  setAdbInstallation,
  socketRef
}) {
  useEffect(() => {
    // Check ADB installation status when component mounts
    fetch('/transfer/check_adb')
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          setAdbInstallation(prev => ({
            ...prev,
            currentStep: 1,
            isComplete: false
          }));
        }
      })
      .catch(error => {
        console.error('Error checking ADB status:', error);
      });

    // Add socket event handlers for ADB installation
    if (socketRef.current) {
      socketRef.current.on('terminal_output', (data) => {
        setAdbInstallation(prev => ({
          ...prev,
          terminalOutput: [...prev.terminalOutput, data.data]
        }));
      });

      socketRef.current.on('installation_started', () => {
        setAdbInstallation(prev => ({
          ...prev,
          isInstalling: true,
          currentStep: 2,
          terminalOutput: [...prev.terminalOutput, "Installation started..."]
        }));
      });

      socketRef.current.on('installation_complete', () => {
        setAdbInstallation(prev => ({
          ...prev,
          isInstalling: false,
          isComplete: true,
          isSuccess: true,
          currentStep: 3,
          terminalOutput: [...prev.terminalOutput, "Installation completed successfully"]
        }));
      });

      socketRef.current.on('installation_failed', (data) => {
        setAdbInstallation(prev => ({
          ...prev,
          isInstalling: false,
          isComplete: true,
          isSuccess: false,
          currentStep: 4,
          terminalOutput: [...prev.terminalOutput, `Installation failed: ${data.error}`]
        }));
      });
    }

    // Cleanup socket listeners
    return () => {
      if (socketRef.current) {
        socketRef.current.off('terminal_output');
        socketRef.current.off('installation_started');
        socketRef.current.off('installation_complete');
        socketRef.current.off('installation_failed');
      }
    };
  }, [socketRef, setAdbInstallation]);

  const handleInstallAdb = () => {
    setAdbInstallation(prev => ({ 
      ...prev, 
      isInstalling: true, 
      currentStep: 2,
      terminalOutput: [...prev.terminalOutput, "Starting ADB installation..."]
    }));
    
    fetch('/transfer/install_adb', { method: 'POST' })
      .catch(error => {
        console.error('Error installing ADB:', error);
        setAdbInstallation(prev => ({
          ...prev,
          isInstalling: false,
          isSuccess: false,
          isComplete: true,
          currentStep: 4,
          terminalOutput: [
            ...prev.terminalOutput,
            `Error installing ADB: ${error.message}`
          ]
        }));
      });
  };

  const getTitle = () => {
    switch (adbInstallation.currentStep) {
      case 1: return 'ADB Not Installed';
      case 2: return 'Installing ADB';
      case 3: return 'Installation Complete';
      case 4: return 'Installation Failed';
      default: return '';
    }
  };

  const getButtons = () => {
    if (adbInstallation.currentStep === 1) {
      return [
        <Button
          key="dashboard"
          variant="secondary"
          onClick={() => window.location.href = '/'}
        >
          Return to Dashboard
        </Button>,
        <Button
          key="install"
          variant="primary"
          onClick={handleInstallAdb}
        >
          Install ADB
        </Button>
      ];
    }
    return null;
  };

  return (
    <Popup
      id="adb-installation-popup"
      title={getTitle()}
      isVisible={adbInstallation.currentStep > 0}
      onClose={() => window.location.reload()}
      buttons={getButtons()}
      variant="terminal"
      showTerminal={adbInstallation.currentStep === 2}
      isInProgress={adbInstallation.isInstalling}
      isComplete={adbInstallation.isComplete}
      isSuccess={adbInstallation.isSuccess}
      progressMessage={adbInstallation.currentStep === 2 ? "Installing ADB..." : ""}
      successMessage="ADB has been successfully installed."
      failureMessage="Failed to install ADB. Please try again or contact support."
      terminalOutput={adbInstallation.terminalOutput}
    />
  );
}

export default AdbInstallation; 