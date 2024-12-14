import Button from '../../shared/Button';

export const StatusButtons = ({ 
  isTransferRunning, 
  filesExist, 
  onStartTransfer, 
  onStopTransfer 
}) => {
  return (
    <div className="flex gap-4">
      <Button
        variant="primary"
        onClick={onStartTransfer}
        disabled={isTransferRunning || !filesExist}
        className={isTransferRunning ? 'hidden' : ''}
      >
        Start Transfer
      </Button>
      <Button
        variant="danger"
        onClick={onStopTransfer}
        disabled={!isTransferRunning}
        className={!isTransferRunning ? 'hidden' : ''}
      >
        Stop Transfer
      </Button>
    </div>
  );
}; 