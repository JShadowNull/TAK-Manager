declare module '@/components/shared/hooks/useSocket' {
  export default function useSocket(namespace: string, options?: {
    eventHandlers?: {
      takserver_status?: (status: { isInstalled: boolean }) => void;
      onConnect?: (socket: any) => void;
      [key: string]: any;
    }
  }): { isConnected: boolean };
} 