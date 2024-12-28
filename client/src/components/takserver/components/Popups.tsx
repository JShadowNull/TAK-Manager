import React from 'react';
import Popup from '../../shared/ui/popups/Popup';
import { Button } from '../../shared/ui/shadcn/button';
import LoadingButton from '../../shared/ui/inputs/LoadingButton';
import { InstallState, UninstallState } from '../types';
import { BACKEND_EVENTS } from '../../shared/hooks/useSocket';

interface PopupsProps {
  // Installation states
  showInstallProgress: boolean;
  showInstallComplete: boolean;
  installState: InstallState;
  onInstallProgressClose: () => void;
  onInstallComplete: () => void;
  onInstallNext: () => void;
  onCancelInstallation: () => void;
  
  // Uninstallation states
  showUninstallConfirm: boolean;
  showUninstallProgress: boolean;
  showUninstallComplete: boolean;
  uninstallState: UninstallState;
  onUninstallConfirmClose: () => void;
  onUninstall: () => void;
  onUninstallProgressClose: () => void;
  onUninstallNext: () => void;
  onUninstallComplete: () => void;
}

const Popups: React.FC<PopupsProps> = ({
  // Installation props
  showInstallProgress,
  showInstallComplete,
  installState,
  onInstallProgressClose,
  onInstallComplete,
  onInstallNext,
  onCancelInstallation,
  
  // Uninstallation props
  showUninstallConfirm,
  showUninstallProgress,
  showUninstallComplete,
  uninstallState,
  onUninstallConfirmClose,
  onUninstall,
  onUninstallProgressClose,
  onUninstallNext,
  onUninstallComplete,
}) => {
  return (
    <>
      {/* Installation Progress Popup */}
      <Popup
        id="installation-popup"
        title={installState.isStoppingInstallation ? "Rolling Back Installation" : "Installing TAK Server"}
        isVisible={showInstallProgress}
        onClose={onInstallProgressClose}
        variant="terminal"
        blurSidebar={true}
        namespace={BACKEND_EVENTS.TAKSERVER_INSTALLER.namespace}
        operationType="install"
        targetId="takserver"
        operation={async () => {
          console.log('[Debug] Installation operation started');
          return new Promise((resolve) => {
            resolve({ success: true });
          });
        }}
        onComplete={() => {
          console.log('[Debug] Installation onComplete callback', {
            isComplete: installState.installationComplete,
            isSuccess: installState.installationSuccess,
            isStopping: installState.isStoppingInstallation,
            error: installState.installationError
          });
          onInstallComplete();
        }}
        onError={(error: string) => {
          console.log('[Debug] Installation onError callback:', error);
          onInstallComplete();
        }}
        nextStepMessage="Installation completed successfully. Click Next to continue."
        failureMessage={installState.installationError || undefined}
        onNext={() => {
          console.log('[Debug] Installation Next button clicked', {
            isComplete: installState.installationComplete,
            isSuccess: installState.installationSuccess,
            isStopping: installState.isStoppingInstallation,
            error: installState.installationError
          });
          onInstallNext();
        }}
        showNextButton={installState.installationComplete}
        onStop={installState.isInstalling ? onCancelInstallation : undefined}
        isStoppingInstallation={installState.isStoppingInstallation}
        buttons={
          <div className="flex gap-2">
            {!installState.installationComplete && (
              <LoadingButton
                operation="stop"
                isLoading={installState.isStoppingInstallation}
                onClick={onCancelInstallation}
                disabled={installState.isStoppingInstallation}
                variant="danger"
                loadingMessage="Rolling back installation..."
                showProgress={true}
              >
                Stop
              </LoadingButton>
            )}
            {installState.installationComplete && (
              <Button onClick={onInstallNext}>
                Next
              </Button>
            )}
          </div>
        }
      />

      {/* Installation Complete Popup */}
      <Popup
        id="install-complete-popup"
        title="Installation Complete"
        isVisible={showInstallComplete}
        variant="standard"
        onClose={onInstallComplete}
        blurSidebar={true}
        buttons={
          <Button
            onClick={onInstallComplete}
            variant="primary"
            className="hover:bg-green-500"
          >
            Close
          </Button>
        }
      >
        {(() => {
          console.log('[Debug] Rendering installation complete popup:', {
            isSuccess: installState.installationSuccess,
            isStopping: installState.isStoppingInstallation,
            error: installState.installationError
          });
          return (
            <div className="text-center">
              {installState.installationSuccess && !installState.isStoppingInstallation ? (
                <>
                  <p className="text-green-500 font-semibold">✓</p>
                  <p className="text-green-500 font-semibold">
                    TAK Server Installation Completed Successfully
                  </p>
                  <p className="text-sm text-gray-300">
                    You can now start using your TAK Server and configure additional features.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-red-500 font-semibold">✗</p>
                  <p className="text-red-500 text-sm font-semibold">
                    {installState.installationError || 'TAK Server Installation Failed'}
                  </p>
                </>
              )}
            </div>
          );
        })()}
      </Popup>

      {/* Uninstall Confirmation Popup */}
      <Popup
        id="uninstall-confirm-popup"
        title="Confirm Uninstall"
        isVisible={showUninstallConfirm}
        onClose={onUninstallConfirmClose}
        variant="standard"
        blurSidebar={true}
        buttons={
          <>
            <Button
              onClick={onUninstallConfirmClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={onUninstall}
              variant="danger"
            >
              Uninstall
            </Button>
          </>
        }
      >
        <div className="text-center">
          <p className="text-red-500 font-semibold">
            Warning: This action cannot be undone
          </p>
          <p className="text-sm text-primary">
            Uninstalling TAK Server will remove all server data, configurations, and certificates.
            Are you sure you want to proceed?
          </p>
        </div>
      </Popup>

      {/* Uninstallation Progress Popup */}
      <Popup
        id="uninstallation-popup"
        title="Uninstalling TAK Server"
        isVisible={showUninstallProgress}
        onClose={onUninstallProgressClose}
        variant="terminal"
        blurSidebar={true}
        namespace={BACKEND_EVENTS.TAKSERVER_UNINSTALL.namespace}
        operationType="uninstall"
        targetId="takserver"
        operation={async () => {
          console.log('[Debug] Uninstallation operation started');
          return new Promise((resolve) => {
            resolve({ success: true });
          });
        }}
        onComplete={() => {
          console.log('[Debug] Uninstallation onComplete callback', {
            isComplete: uninstallState.uninstallComplete,
            isSuccess: uninstallState.uninstallSuccess
          });
        }}
        onError={(error: string) => {
          console.log('[Debug] Uninstallation onError callback:', error);
        }}
        nextStepMessage="Uninstallation completed successfully. Click Next to continue."
        failureMessage={uninstallState.uninstallError || undefined}
        onNext={() => {
          console.log('[Debug] Uninstallation Next button clicked', {
            isComplete: uninstallState.uninstallComplete,
            isSuccess: uninstallState.uninstallSuccess
          });
          onUninstallNext();
        }}
        showNextButton={uninstallState.uninstallComplete}
      />

      {/* Uninstallation Complete Popup */}
      <Popup
        id="uninstall-complete-popup"
        title="Uninstallation Complete"
        isVisible={showUninstallComplete}
        variant="standard"
        onClose={onUninstallComplete}
        blurSidebar={true}
        buttons={
          <Button
            onClick={onUninstallComplete}
            variant="primary"
            className="hover:bg-green-500"
          >
            Close
          </Button>
        }
      >
        <div className="text-center">
          {uninstallState.uninstallSuccess ? (
            <>
              <p className="text-green-500 font-semibold">✓</p>
              <p className="text-green-500 font-semibold">
                TAK Server Uninstallation Completed Successfully
              </p>
              <p className="text-sm text-gray-300">
                TAK Server has been completely removed from your system.
              </p>
            </>
          ) : (
            <>
              <p className="text-red-500 font-semibold">✗</p>
              <p className="text-red-500 text-sm font-semibold">
                TAK Server Uninstallation Failed
              </p>
            </>
          )}
        </div>
      </Popup>
    </>
  );
};

export default Popups; 