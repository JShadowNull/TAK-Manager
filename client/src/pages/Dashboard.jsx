import React from 'react';
import useSocket, { BACKEND_EVENTS } from '../components/shared/hooks/useSocket';
import useFetch from '../components/shared/hooks/useFetch';
import { AnalyticsChart } from '../components/shared/ui/shadcn/charts/AnalyticsChart';
import CustomScrollbar from '../components/shared/ui/layout/CustomScrollbar';
import ContainerStateIcon from '../components/shared/ui/inputs/ContainerStateIcon';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/shared/ui/shadcn/card/card"

const INITIAL_DOCKER_STATE = {
  containers: [],
  error: null,
  status: null
};

function Dashboard() {
  const { post } = useFetch();
  
  // Docker Manager Socket
  const {
    state: dockerState = INITIAL_DOCKER_STATE,
    isConnected: isDockerConnected,
    error: dockerError,
    emit
  } = useSocket(BACKEND_EVENTS.DOCKER_MANAGER.namespace, {
    initialState: INITIAL_DOCKER_STATE,
    eventHandlers: {
      'initial_state': (data, { updateState }) => {
        console.info('Received initial state:', data);
        const newState = {
          containers: data.containers || [],
          error: data.error || null
        };
        updateState(newState);
      },
      [BACKEND_EVENTS.DOCKER_MANAGER.events.CONTAINERS_LIST]: (data, { updateState }) => {
        console.info('Received containers update:', data);
        if (Array.isArray(data.containers)) {
          updateState({
            containers: data.containers,
            error: null
          });
        }
      }
    }
  });

  // Services Monitor Socket
  const {
    state: servicesState,
    isConnected: isServicesConnected,
    error: servicesError
  } = useSocket('/services-monitor', {
    initialState: {
      cpuData: [],
      ramData: [],
      cpuUsage: 'Loading...',
      ramUsage: 'Loading...',
      loading: true
    },
    eventHandlers: {
      initial_state: (data, { updateState }) => {
        updateState({
          ...data,
          cpuUsage: `${data.cpu}%`,
          ramUsage: `${data.ram}%`,
          loading: false
        });
      },
      system_metrics: (data, { state, updateState }) => {
        const timestamp = new Date().getTime();
        
        updateState({
          cpuUsage: `${data.cpu}%`,
          ramUsage: `${data.ram}%`,
          cpuData: [...(state.cpuData || []), {
            month: timestamp,
            desktop: data.cpu
          }].slice(-30),
          ramData: [...(state.ramData || []), {
            month: timestamp,
            desktop: data.ram
          }].slice(-30)
        });
      },
      error: (data, { updateState }) => {
        console.error('Services monitor error:', data.message);
        updateState({ error: data.message });
      }
    }
  });

  // IP Fetcher Socket
  const {
    state: networkState,
    isConnected: isNetworkConnected,
    error: networkError
  } = useSocket('/ip-fetcher', {
    initialState: {
      networkData: [],
      ipAddress: 'Loading...',
      networkUsage: {
        upload: '↑ 0 MB/s',
        download: '↓ 0 MB/s',
        total: '0 MB/s'
      }
    },
    eventHandlers: {
      network_metrics: (data, { state, updateState }) => {
        if (data && data.network) {
          const { upload, download, total } = data.network;
          const timestamp = new Date().getTime();
          
          updateState({
            ipAddress: data.ip_address,
            networkUsage: {
              upload: `↑ ${upload.toFixed(2)} MB/s`,
              download: `↓ ${download.toFixed(2)} MB/s`,
              total: `${total.toFixed(2)} MB/s`
            },
            networkData: [...(state.networkData || []), {
              month: timestamp,
              upload,
              download,
              desktop: total
            }].slice(-30)
          });
        }
      }
    }
  });

  const isContainerRunning = (status) => {
    const lowerStatus = status.toLowerCase();
    return lowerStatus.includes('up') || 
           lowerStatus.includes('running') ||
           lowerStatus.includes('(healthy)') ||
           lowerStatus.includes('(unhealthy)');
  };

  // Show loading state if any socket is not connected
  if (!isServicesConnected || !isNetworkConnected || !isDockerConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Connecting to services...</h2>
          <p className="text-muted-foreground">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  // Show error state if any socket has an error
  if (servicesError || networkError || dockerError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p>{servicesError?.message || networkError?.message || dockerError?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Monitoring Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* CPU Usage Section */}
        <AnalyticsChart
          data={servicesState.cpuData}
          title="CPU Usage"
          description="Real-time CPU utilization"
          trendingValue={servicesState.cpuUsage}
          chartColor="blue"
          className="w-full"
        />

        {/* RAM Usage Section */}
        <AnalyticsChart
          data={servicesState.ramData}
          title="RAM Usage"
          description="Real-time memory utilization"
          trendingValue={servicesState.ramUsage}
          chartColor="green"
          className="w-full"
        />

        {/* Network & IP Section */}
        <AnalyticsChart
          data={networkState.networkData}
          title="Network Traffic"
          description={`Current IP: ${networkState.ipAddress} | ${networkState.networkUsage.upload} | ${networkState.networkUsage.download}`}
          trendingValue={networkState.networkUsage.total}
          chartColor="yellow"
          className="w-full"
        />

        {/* Docker Containers Section */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Docker Containers</CardTitle>
            <CardDescription>Container Status & Controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[25rem] overflow-auto rounded-lg border">
              <ul className="list-none space-y-2 divide-y divide-border text-sm text-muted-foreground p-2">
                {dockerState.containers.length === 0 ? (
                  <li className="border-1 border-border p-4 rounded">No containers found</li>
                ) : (
                  dockerState.containers.map(container => {
                    const running = isContainerRunning(container.status);
                    return (
                      <li key={container.name} className="p-4 rounded flex justify-between items-center space-x-4">
                        <span className="flex-grow truncate">
                          Container: {container.name} (Status: {container.status})
                        </span>
                        <ContainerStateIcon
                          containerName={container.name}
                          isRunning={running}
                          onOperation={async (containerName, action) => {
                            console.debug('[Dashboard] Container operation:', {
                              containerName,
                              action
                            });
                            try {
                              const response = await post(`/docker-manager/docker/containers/${containerName}/${action}`);
                              console.debug('[Dashboard] Operation response:', response);
                              return response;
                            } catch (error) {
                              console.error('[Dashboard] Operation failed:', error);
                              throw error;
                            }
                          }}
                          onOperationComplete={() => emit('check_status')}
                        />
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard; 