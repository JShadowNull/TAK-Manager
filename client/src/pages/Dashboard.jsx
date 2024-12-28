import React from 'react';
import CustomScrollbar from '../components/shared/ui/layout/CustomScrollbar';
import useSocket from '../components/shared/hooks/useSocket';
import { AnalyticsChart } from '../components/shared/ui/shadcn/charts/AnalyticsChart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/shared/ui/shadcn/card/card"

function Dashboard() {
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
      services: [],
      loading: true
    },
    eventHandlers: {
      cpu_usage: (data, { state, updateState }) => {
        if (data && typeof data.cpu_usage === 'number') {
          const currentTime = new Date();
          updateState({
            cpuUsage: `${data.cpu_usage}%`,
            cpuData: [...(state.cpuData || []), {
              month: currentTime.toISOString(),
              desktop: data.cpu_usage
            }].slice(-30)
          });
        }
      },
      ram_usage: (data, { state, updateState }) => {
        if (data && typeof data.ram_usage === 'number') {
          const currentTime = new Date();
          updateState({
            ramUsage: `${data.ram_usage}%`,
            ramData: [...(state.ramData || []), {
              month: currentTime.toISOString(),
              desktop: data.ram_usage
            }].slice(-30)
          });
        }
      },
      services: (data, { updateState }) => {
        if (data && Array.isArray(data.services)) {
          updateState({
            services: data.services,
            loading: false
          });
        }
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
          const currentTime = new Date();
          
          updateState({
            ipAddress: data.ip_address,
            networkUsage: {
              upload: `↑ ${upload.toFixed(2)} MB/s`,
              download: `↓ ${download.toFixed(2)} MB/s`,
              total: `${total.toFixed(2)} MB/s`
            },
            networkData: [...(state.networkData || []), {
              month: currentTime.toISOString(),
              upload,
              download,
              desktop: total
            }].slice(-30)
          });
        }
      }
    }
  });

  // Show loading state if either socket is not connected
  if (!isServicesConnected || !isNetworkConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Connecting to services...</h2>
          <p className="text-muted-foreground">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  // Show error state if either socket has an error
  if (servicesError || networkError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p>{servicesError?.message || networkError?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Monitoring Section */}
      <div className="flex flex-wrap gap-6">
        {/* CPU Usage Section */}
        <AnalyticsChart
          data={servicesState.cpuData}
          title="CPU Usage"
          description="Real-time CPU utilization"
          trendingValue={servicesState.cpuUsage}
          chartColor="blue"
          className="flex-1 min-w-[28rem]"
        />

        {/* RAM Usage Section */}
        <AnalyticsChart
          data={servicesState.ramData}
          title="RAM Usage"
          description="Real-time memory utilization"
          trendingValue={servicesState.ramUsage}
          chartColor="green"
          className="flex-1 min-w-[28rem]"
        />

        {/* Running Services Section */}
        <Card className="flex-1 min-w-[28rem]">
          <CardHeader>
            <CardTitle>Running Services</CardTitle>
            <CardDescription>Active system processes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] overflow-hidden rounded-lg border">
              <CustomScrollbar>
                <div className="h-full">
                  <ul className="list-none text-sm m-0 p-0">
                    {servicesState.loading ? (
                      <li className="p-4 text-muted-foreground">Loading services...</li>
                    ) : servicesState.services.length > 0 ? (
                      servicesState.services.map((service) => (
                        <li
                          key={service.pid}
                          className="p-4 hover:bg-muted transition-colors duration-200 text-muted-foreground border-b last:border-b-0"
                        >
                          {service.name} (PID: {service.pid})
                        </li>
                      ))
                    ) : (
                      <li className="p-4 text-muted-foreground">No services found</li>
                    )}
                  </ul>
                </div>
              </CustomScrollbar>
            </div>
          </CardContent>
        </Card>

        {/* Network & IP Section */}
        <AnalyticsChart
          data={networkState.networkData}
          title="Network Traffic"
          description={`Current IP: ${networkState.ipAddress} | ${networkState.networkUsage.upload} | ${networkState.networkUsage.download}`}
          trendingValue={networkState.networkUsage.total}
          chartColor="yellow"
          className="flex-1 min-w-[28rem]"
        />
      </div>
    </div>
  );
}

export default Dashboard; 