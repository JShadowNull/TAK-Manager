import CustomScrollbar from '../../CustomScrollbar';

export const TransferLog = ({ logs }) => {
  return (
    <div className="bg-cardBg p-6 rounded-lg shadow-lg text-white border-1 border-accentBoarder">
      <h2 className="text-base mb-4">Transfer Log</h2>
      <div className="h-64 border border-accentBoarder rounded-lg mt-4">
        <CustomScrollbar>
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
        </CustomScrollbar>
      </div>
    </div>
  );
}; 