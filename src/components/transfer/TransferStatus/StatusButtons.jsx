import Button from '../../shared/ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shared/ui/shadcn/tooltip/tooltip';

export const StatusButtons = ({ 
  isTransferRunning, 
  filesExist,
  isDeviceConnected,
  onStartTransfer, 
  onStopTransfer 
}) => {
  const getStartButtonTooltip = () => {
    if (!filesExist) return 'No files available to transfer';
    if (!isDeviceConnected) return 'No device connected';
    if (isTransferRunning) return 'Transfer in progress';
    return 'Start file transfer to connected devices';
  };

  return (
    <div className="flex gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="primary"
                onClick={onStartTransfer}
                disabled={isTransferRunning || !filesExist || !isDeviceConnected}
                className={isTransferRunning ? 'hidden' : ''}
                aria-label="Start Transfer"
              >
                Start Transfer
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getStartButtonTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="danger"
                onClick={onStopTransfer}
                disabled={!isTransferRunning}
                className={!isTransferRunning ? 'hidden' : ''}
                aria-label="Stop Transfer"
              >
                Stop Transfer
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isTransferRunning ? 'Stop current transfer' : 'No transfer in progress'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}; 