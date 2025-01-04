import useSocket from '../../shared/hooks/useSocket';

export interface OtaState {
  isInstalling: boolean;
}

export const useOtaSocket = () => {
  return useSocket('/ota-update', {
    eventHandlers: {
      handleTerminalOutput: true,
      'terminal_output': (data: { data: string }, { appendToTerminal }) => {
        if (data.data) {
          appendToTerminal(data.data);
        }
      }
    },
    initialState: {
      isInstalling: false
    }
  });
}; 