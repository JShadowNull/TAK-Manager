import React, { useEffect, useState } from 'react';
import ContainerStateIcon from '../components/shared/ui/inputs/ContainerStartStopButton';
import { AnalyticsChart } from '../components/shared/ui/shadcn/charts/AnalyticsChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/shared/ui/shadcn/card/card';
import { ConnectedClientsCard } from '../components/dashboard/ConnectedClientsCard';
import { useTakServer } from '../components/shared/ui/shadcn/sidebar/app-sidebar';

interface SystemMetrics {
  totalCpu: number;
  totalMemory: number;  // in MB
  network: {
    upload: number;    // in MB/s
    download: number;  // in MB/s
  };
  timestamp: number;
}

interface Container {
  id: string;
  name: string;
  state: string;
  status: string;
  running: boolean;
  started_at: string;
  finished_at: string;
  image: string;
  operation?: {
    action: string;
    status: string;
    error?: string;
  };
}

export const Dashboard: React.FC = () => {
  // Load initial state from localStorage if available
  const [metrics, setMetrics] = useState<SystemMetrics>(() => {
    const cached = localStorage.getItem('dashboard_metrics');
    return cached ? JSON.parse(cached) : {
      totalCpu: 0,
      totalMemory: 0,
      network: { upload: 0, download: 0 },
      timestamp: 0
    };
  });
  
  const [containers, setContainers] = useState<Container[]>(() => {
    const cached = localStorage.getItem('dashboard_containers');
    return cached ? JSON.parse(cached) : [];
  });

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Get TAK server state from context
  const { serverState } = useTakServer();
  const takServerActive = serverState.isInstalled && serverState.isRunning;

  // Load historical data from localStorage
  const [cpuHistory, setCpuHistory] = useState<number[]>(() => {
    const cached = localStorage.getItem('dashboard_cpu_history');
    return cached ? JSON.parse(cached) : [];
  });
  
  const [memoryHistory, setMemoryHistory] = useState<number[]>(() => {
    const cached = localStorage.getItem('dashboard_memory_history');
    return cached ? JSON.parse(cached) : [];
  });
  
  const [uploadHistory, setUploadHistory] = useState<number[]>(() => {
    const cached = localStorage.getItem('dashboard_upload_history');
    return cached ? JSON.parse(cached) : [];
  });
  
  const [downloadHistory, setDownloadHistory] = useState<number[]>(() => {
    const cached = localStorage.getItem('dashboard_download_history');
    return cached ? JSON.parse(cached) : [];
  });

  // Maximum number of points to keep in history
  const MAX_HISTORY_LENGTH = 20;

  // Save data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard_metrics', JSON.stringify(metrics));
  }, [metrics]);

  useEffect(() => {
    localStorage.setItem('dashboard_containers', JSON.stringify(containers));
  }, [containers]);

  useEffect(() => {
    localStorage.setItem('dashboard_cpu_history', JSON.stringify(cpuHistory));
  }, [cpuHistory]);

  useEffect(() => {
    localStorage.setItem('dashboard_memory_history', JSON.stringify(memoryHistory));
  }, [memoryHistory]);

  useEffect(() => {
    localStorage.setItem('dashboard_upload_history', JSON.stringify(uploadHistory));
  }, [uploadHistory]);

  useEffect(() => {
    localStorage.setItem('dashboard_download_history', JSON.stringify(downloadHistory));
  }, [downloadHistory]);

  // Initialize SSE connections
  useEffect(() => {
    let metricsEventSource: EventSource | null = null;
    let dockerEventSource: EventSource | null = null;

    const setupSSEConnections = async () => {
      try {
        // Set up SSE connections first
        setupMetricsEventSource();
        setupDockerEventSource();

        // Get initial metrics
        const response = await fetch('/api/dashboard/monitoring/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to get initial metrics');
        }

        const data = await response.json();
        const initialMetrics = data?.data || data;
        
        if (!initialMetrics) {
          throw new Error('No metrics data received from server');
        }

        setMetrics(initialMetrics);
        setCpuHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), initialMetrics.totalCpu]);
        setMemoryHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), initialMetrics.totalMemory]);
        setUploadHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), initialMetrics.network.upload]);
        setDownloadHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), initialMetrics.network.download]);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
      }
    };

    const setupMetricsEventSource = () => {
      if (metricsEventSource) {
        metricsEventSource.close();
      }

      metricsEventSource = new EventSource('/api/dashboard/monitoring/metrics-stream');
      
      metricsEventSource.addEventListener('system-metrics', (event) => {
        try {
          const newMetrics: SystemMetrics = JSON.parse(event.data);
          
          // Validate the data structure
          if (typeof newMetrics.totalCpu !== 'number' || 
              typeof newMetrics.totalMemory !== 'number' || 
              typeof newMetrics.network?.upload !== 'number' || 
              typeof newMetrics.network?.download !== 'number') {
            console.error('Invalid metrics data structure:', newMetrics);
            return;
          }
          
          setMetrics(newMetrics);
          
          // Update historical data
          setCpuHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), newMetrics.totalCpu]);
          setMemoryHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), newMetrics.totalMemory]);
          setUploadHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), newMetrics.network.upload]);
          setDownloadHistory(prev => [...prev.slice(-MAX_HISTORY_LENGTH), newMetrics.network.download]);
        } catch (error) {
          console.error('Error processing system metrics:', error);
        }
      });

      metricsEventSource.addEventListener('error', () => {
        console.error('Metrics SSE connection error - attempting to reconnect...');
        setTimeout(setupMetricsEventSource, 5000);
      });
    };

    const setupDockerEventSource = () => {
      if (dockerEventSource) {
        dockerEventSource.close();
      }

      dockerEventSource = new EventSource('/api/docker-manager/containers/status-stream');
      
      dockerEventSource.addEventListener('docker_status', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'container_status') {
            setContainers(data.containers);
            
            // Update loading states based on operations
            const newLoadingStates: Record<string, boolean> = {};
            data.containers.forEach((container: Container) => {
              if (container.operation?.status === 'in_progress') {
                newLoadingStates[container.name] = true;
              }
            });
            setLoadingStates(newLoadingStates);
          }
        } catch (error) {
          console.error('Error processing docker status:', error);
        }
      });

      dockerEventSource.addEventListener('error', () => {
        console.error('Docker SSE connection error - attempting to reconnect...');
        setTimeout(setupDockerEventSource, 5000);
      });
    };

    // Initial setup
    setupSSEConnections();

    // Cleanup
    return () => {
      if (metricsEventSource) {
        metricsEventSource.close();
      }
      if (dockerEventSource) {
        dockerEventSource.close();
      }
    };
  }, []);

  const handleContainerOperation = async (name: string, action: string) => {
    try {
      console.log('Container operation requested:', {
        container: name,
        action: action,
        currentLoadingStates: loadingStates,
        timestamp: new Date().toISOString()
      });

      setLoadingStates(prev => {
        const newState = {
          ...prev,
          [name]: true
        };
        console.log('Setting initial loading state:', {
          container: name,
          loadingStates: newState,
          timestamp: new Date().toISOString()
        });
        return newState;
      });

      const response = await fetch(`/api/docker-manager/containers/${name}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} container: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} container:`, {
        container: name,
        error,
        timestamp: new Date().toISOString()
      });
      
      setLoadingStates(prev => {
        const newState = {
          ...prev,
          [name]: false
        };
        console.log('Setting error loading state:', {
          container: name,
          loadingStates: newState,
          timestamp: new Date().toISOString()
        });
        return newState;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnalyticsChart
          data={cpuHistory}
          title="CPU Usage"
          description="Real-time CPU utilization"
          trendingValue={`${metrics.totalCpu.toFixed(2)}%`}
          chartColor="blue"
          className="w-full break-normal"
        />
        <AnalyticsChart
          data={memoryHistory}
          title="RAM Usage"
          description="Real-time memory utilization"
          trendingValue={`${metrics.totalMemory.toFixed(2)} MB`}
          chartColor="red"
          className="w-full break-normal"
        />
        <AnalyticsChart
          data={uploadHistory}
          title="Network Upload"
          description="Network upload speed"
          trendingValue={`${metrics.network.upload.toFixed(2)} MB/s`}
          chartColor="green"
          className="w-full break-normal"
        />
        <AnalyticsChart
          data={downloadHistory}
          title="Network Download"
          description="Network download speed"
          trendingValue={`${metrics.network.download.toFixed(2)} MB/s`}
          chartColor="yellow"
          className="w-full break-normal"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Docker Containers</CardTitle>
            <CardDescription>Container Status & Controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border">
              <ul className="list-none space-y-2 divide-y divide-border text-sm text-muted-foreground p-2">
                {containers.length === 0 ? (
                  <li className="border-1 border-border p-4 rounded">No containers found</li>
                ) : (
                  containers.map((container) => (
                    <li key={container.id} className="p-4 rounded flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-4">
                      <div className="grow w-full">
                        <div className="font-medium">{container.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Status: {container.status} | Image: {container.image}
                        </div>
                      </div>
                      <div className="w-full lg:w-auto">
                        <ContainerStateIcon
                          name={container.name}
                          isRunning={container.running}
                          isLoading={loadingStates[container.name]}
                          onOperation={handleContainerOperation}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {takServerActive && <ConnectedClientsCard />}
      </div>
    </div>
  );
};

export default Dashboard;