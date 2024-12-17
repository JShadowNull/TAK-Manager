import React, { useEffect, useRef } from 'react';
import Popup from '../shared/Popup';
import Button from '../shared/Button';
import useFetch from '../../hooks/useFetch';

function AdbInstallation({
  adbInstallation,
  setAdbInstallation,
  socketRef
}) {
  const { get, post } = useFetch();
  const hasCheckedAdb = useRef(false);

  useEffect(() => {
    // Only check ADB installation status once
    if (!hasCheckedAdb.current) {
      hasCheckedAdb.current = true;
      
      get('/transfer/check_adb', {
        validateResponse: (data) => ({
          isValid: typeof data.success === 'boolean',
          error: 'Invalid response format'
        })
      })
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
        setAdbInstallation(prev => ({
          ...prev,
          currentStep: 1,
          isComplete: false
        }));
      });
    }

    // Socket event handlers setup
    const socket = socketRef.current;
    if (socket) {
      const handlers = {
        'terminal_output': (data) => {
          setAdbInstallation(prev => ({
            ...prev,
            terminalOutput: [...prev.terminalOutput, data.data]
          }));
        },
        'installation_started': () => {
          setAdbInstallation(prev => ({
            ...prev,
            isInstalling: true,
            currentStep: 2,
            terminalOutput: [...prev.terminalOutput, "Installation started..."]
          }));
        },
        'installation_complete': () => {
          setAdbInstallation(prev => ({
            ...prev,
            isInstalling: false,
            isComplete: true,
            isSuccess: true,
            currentStep: 3,
            terminalOutput: [...prev.terminalOutput, "Installation completed successfully"]
          }));
        },
        'installation_failed': (data) => {
          setAdbInstallation(prev => ({
            ...prev,
            isInstalling: false,
            isComplete: true,
            isSuccess: false,
            currentStep: 4,
            terminalOutput: [...prev.terminalOutput, `Installation failed: ${data.error}`]
          }));
        }
      };

      // Register all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler);
      });

      // Cleanup function
      return () => {
        // Only cleanup if socket still exists
        if (socket) {
          Object.keys(handlers).forEach(event => {
            socket.off(event);
          });
        }
      };
    }
  }, [get, socketRef, setAdbInstallation]);

  const handleInstallAdb = () => {
    setAdbInstallation(prev => ({ 
      ...prev, 
      isInstalling: true, 
      currentStep: 2,
      terminalOutput: [...prev.terminalOutput, "Starting ADB installation..."]
    }));
    
    post('/transfer/install_adb', null, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateResponse: (data) => ({
        isValid: true, // Installation status is handled by socket events
        error: null
      })
    })
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