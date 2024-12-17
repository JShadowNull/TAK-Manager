import React, { useState, useEffect } from 'react';
import CustomScrollbar from '../components/shared/ui/CustomScrollbar';
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
  const [cpuData, setCpuData] = useState([]);
  const [ramData, setRamData] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  const [cpuUsage, setCpuUsage] = useState('Loading...');
  const [ramUsage, setRamUsage] = useState('Loading...');
  const [ipAddress, setIpAddress] = useState('Loading...');
  const [networkUsage, setNetworkUsage] = useState({
    upload: '0 MB/s',
    download: '0 MB/s',
    total: '0 MB/s'
  });

  const [services, setServices] = useState([]);

  // Setup socket handlers
  const servicesSocketHandlers = {
    cpu_usage: (data) => {
      console.log('Received CPU usage:', data);
      if (data && typeof data.cpu_usage === 'number') {
        setCpuUsage(`${data.cpu_usage}%`);
        const currentTime = new Date();
        setCpuData(prev => {
          const newData = [...prev, { month: currentTime.toISOString(), desktop: data.cpu_usage }];
          return newData.slice(-30);
        });
      }
    },
    ram_usage: (data) => {
      console.log('Received RAM usage:', data);
      if (data && typeof data.ram_usage === 'number') {
        setRamUsage(`${data.ram_usage}%`);
        const currentTime = new Date();
        setRamData(prev => {
          const newData = [...prev, { month: currentTime.toISOString(), desktop: data.ram_usage }];
          return newData.slice(-30);
        });
      }
    },
    services: (data) => {
      console.log('Received services:', data);
      if (data && Array.isArray(data.services)) {
        setServices(data.services);
      }
    },
    error: (data) => {
      console.error('Services monitor error:', data.message);
    },
    onConnect: () => {
      console.log('Services monitor socket connected');
      if (servicesSocket.socket) {
        console.log('Requesting initial metrics...');
        servicesSocket.socket.emit('request_metrics');
      } else {
        console.error('Socket not available for requesting metrics');
      }
    },
    onDisconnect: () => {
      console.log('Services monitor socket disconnected');
    },
    onError: (error) => {
      console.error('Services monitor socket connection error:', error);
    }
  };

  const ipSocketHandlers = {
    network_metrics: (data) => {
      if (data && data.network) {
        setIpAddress(data.ip_address);
        const { upload, download, total } = data.network;
        
        setNetworkUsage({
          upload: `↑ ${upload.toFixed(2)} MB/s`,
          download: `↓ ${download.toFixed(2)} MB/s`,
          total: `${total.toFixed(2)} MB/s`
        });
        
        const currentTime = new Date();
        setNetworkData(prev => {
          const newData = [...prev, { 
            month: currentTime.toISOString(),
            upload,
            download,
            desktop: total
          }];
          return newData.slice(-30);
        });
      }
    },
    error: (data) => {
      console.error('IP fetcher error:', data.message);
    },
    onConnect: () => {
      console.log('IP socket connected');
      if (ipSocket.socket) {
        ipSocket.socket.emit('get_ip_address');
      }
    },
    onError: (error) => {
      console.error('IP socket connection error:', error);
    }
  };

  // Initialize sockets using the hook
  const servicesSocket = useSocket('/services-monitor', {
    eventHandlers: servicesSocketHandlers
  });

  const ipSocket = useSocket('/ip-fetcher', {
    eventHandlers: ipSocketHandlers
  });

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Monitoring Section */}
      <div className="flex flex-wrap gap-8">
        {/* CPU Usage Section */}
        <AnalyticsChart
          data={cpuData}
          title="CPU Usage"
          description="Real-time CPU utilization"
          trendingValue={cpuUsage}
          chartColor="blue"
          className="flex-1 min-w-[28rem]"
        />

        {/* RAM Usage Section */}
        <AnalyticsChart
          data={ramData}
          title="RAM Usage"
          description="Real-time memory utilization"
          trendingValue={ramUsage}
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
                    {services.length > 0 ? (
                      services.map((service) => (
                        <li
                          key={service.pid}
                          className="p-4 hover:bg-muted transition-colors duration-200 text-muted-foreground border-b last:border-b-0"
                        >
                          {service.name} (PID: {service.pid})
                        </li>
                      ))
                    ) : (
                      <li className="p-4 text-muted-foreground">Loading services...</li>
                    )}
                  </ul>
                </div>
              </CustomScrollbar>
            </div>
          </CardContent>
        </Card>

        {/* Network & IP Section */}
        <AnalyticsChart
          data={networkData}
          title="Network Traffic"
          description={`Current IP: ${ipAddress} | ${networkUsage.upload} | ${networkUsage.download}`}
          trendingValue={networkUsage.total}
          chartColor="yellow"
          className="flex-1 min-w-[28rem]"
        />
      </div>
    </div>
  );
}

export default Dashboard; 