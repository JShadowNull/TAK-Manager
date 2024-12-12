import Button from '../../Button';

export const StatusButtons = ({ 
  isTransferRunning, 
  filesExist, 
  onStartTransfer, 
  onStopTransfer 
}) => {
  return (
    <div className="flex gap-4">
      <Button
        text="Start Transfer"
        hoverColor="green"
        onClick={onStartTransfer}
        disabled={isTransferRunning || !filesExist}
        additionalClasses={isTransferRunning ? 'hidden' : ''}
      />
      <Button
        text="Stop Transfer"
        hoverColor="red"
        onClick={onStopTransfer}
        disabled={!isTransferRunning}
        additionalClasses={!isTransferRunning ? 'hidden' : ''}
      />
    </div>
  );
}; 