import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';

export const TransferLog = ({ logs }) => {
  return (
    <div className="bg-card p-6 rounded-lg shadow-lg foreground border-1 border-border">
      <h2 className="text-base mb-4">Transfer Log</h2>
      <div className="h-64 border border-border rounded-lg mt-4">
        <ScrollArea autoScroll content={logs}>
          <div className="list-none space-y-2 text-textSecondary text-sm p-2">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`select-text ${
                  log.includes('Device connected') ? 'text-green-500' :
                  log.includes('Device disconnected') ? 'text-yellow-500' :
                  ''
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}; 