import React, { useEffect, useState } from 'react';
import ContainerStateIcon from '../components/shared/ui/inputs/ContainerStartStopButton';
import useFetch from '../components/shared/hooks/useFetch';
import { AnalyticsChart } from '../components/shared/ui/shadcn/charts/AnalyticsChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/shared/ui/shadcn/card/card';

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
  const fetch = useFetch();

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

  // Initialize SSE connection for both metrics and container updates
  useEffect(() => {
    // Start container updates
    const startContainerUpdates = async () => {
      try {
        const response = await fetch.post('/api/docker-manager/containers/updates/start');
        // Check if response is an Axios response (has data property)
        const data = response.data || response;
        
        if (!response.ok && !response.status) {
          throw new Error(data.message || 'Failed to start container updates');
        }
      } catch (error) {
        // Only log real errors, not successful responses
        if (error instanceof Error && error.message !== 'undefined' && !error.message.includes('json')) {
          console.error('Failed to start container updates:', error);
        }
      }
    };
    startContainerUpdates();

    // Set up metrics polling
    const pollMetrics = async () => {
      try {
        const response = await fetch.post('/api/dashboard/monitoring/start');
        // Check if response is an Axios response (has data property)
        const data = response.data || response;
        
        if (!response.ok && !response.status) {
          throw new Error(data.message || 'Failed to get metrics');
        }
      } catch (error) {
        // Only log real errors, not successful responses
        if (error instanceof Error && error.message !== 'undefined' && !error.message.includes('json')) {
          console.error('Failed to get metrics:', error);
        }
      }
    };

    // Poll metrics every 3 seconds
    const metricsInterval = setInterval(pollMetrics, 3000);

    const eventSource = new EventSource('/stream');

    // Handle system metrics updates
    eventSource.addEventListener('system_metrics', (event) => {
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

    // Handle docker status updates
    eventSource.addEventListener('docker_status', (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'container_update':
          // Update containers list
          setContainers(data.containers);
          // Clear loading states only after container list is updated
          setLoadingStates({});
          break;

        case 'error':
          console.error('Docker error:', data.message);
          // Clear loading state for the affected container
          if (data.details?.container) {
            setLoadingStates(prev => ({
              ...prev,
              [data.details.container]: false
            }));
          }
          break;

        default:
          // Handle operation status updates (start/stop)
          if (data.status === 'in_progress') {
            // Set loading state when operation starts
            setLoadingStates(prev => ({
              ...prev,
              [data.details.container]: true
            }));
          } else if (data.status === 'completed' || data.status === 'error') {
            // Don't clear loading state immediately
            // Wait for container_update event to ensure proper state
            setTimeout(async () => {
              try {
                // Request fresh container list
                await fetch.post('/api/docker-manager/containers/updates/start');
              } catch (error) {
                console.error('Failed to get container updates:', error);
                // If update fails, clear loading state as fallback
                setLoadingStates(prev => ({
                  ...prev,
                  [data.details.container]: false
                }));
              }
            }, 500); // Small delay to ensure container state has settled
          }
      }
    });

    eventSource.addEventListener('error', (error) => {
      console.error('SSE connection error:', error);
      setTimeout(() => {
        eventSource.close();
        const newEventSource = new EventSource('/stream');
        // Re-attach event listeners
      }, 5000);
    });

    return () => {
      eventSource.close();
      clearInterval(metricsInterval);
    };
  }, []);

  const handleContainerOperation = async (name: string, action: string) => {
    try {
      setLoadingStates(prev => ({
        ...prev,
        [name]: true
      }));
      await fetch.post(`/api/docker-manager/containers/${name}/${action}`);
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      setLoadingStates(prev => ({
        ...prev,
        [name]: false
      }));
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
          className="w-full"
        />
        <AnalyticsChart
          data={memoryHistory}
          title="RAM Usage"
          description="Real-time memory utilization"
          trendingValue={`${metrics.totalMemory.toFixed(2)} MB`}
          chartColor="red"
          className="w-full"
        />
        <AnalyticsChart
          data={uploadHistory}
          title="Network Upload"
          description="Network upload speed"
          trendingValue={`${metrics.network.upload.toFixed(2)} MB/s`}
          chartColor="green"
          className="w-full"
        />
        <AnalyticsChart
          data={downloadHistory}
          title="Network Download"
          description="Network download speed"
          trendingValue={`${metrics.network.download.toFixed(2)} MB/s`}
          chartColor="yellow"
          className="w-full"
        />
      </div>

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
                  <li key={container.id} className="p-4 rounded flex justify-between items-center space-x-4">
                    <div className="flex-grow">
                      <div className="font-medium">{container.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Status: {container.status} | Image: {container.image}
                      </div>
                    </div>
                    <ContainerStateIcon
                      name={container.name}
                      isRunning={container.running}
                      isLoading={loadingStates[container.name]}
                      onOperation={handleContainerOperation}
                    />
                  </li>
                ))
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;