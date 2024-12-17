import React, { useRef, useState, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { 
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import CustomScrollbar from '../components/CustomScrollbar';
import useSocket from '../hooks/useSocket';

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

function Dashboard() {
  const cpuChartRef = useRef(null);
  const ramChartRef = useRef(null);
  const cpuChart = useRef(null);
  const ramChart = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [cpuUsage, setCpuUsage] = useState('Loading...');
  const [ramUsage, setRamUsage] = useState('Loading...');
  const [ipAddress, setIpAddress] = useState('Loading...');
  const [services, setServices] = useState([]);

  // Setup socket handlers
  const servicesSocketHandlers = {
    cpu_usage: (data) => {
      console.log('Received CPU usage:', data);
      if (data && typeof data.cpu_usage === 'number') {
        setCpuUsage(`${data.cpu_usage}%`);
        updateChart(cpuChart.current, data.cpu_usage, 'cpu');
      }
    },
    ram_usage: (data) => {
      console.log('Received RAM usage:', data);
      if (data && typeof data.ram_usage === 'number') {
        setRamUsage(`${data.ram_usage}%`);
        updateChart(ramChart.current, data.ram_usage, 'ram');
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
      // Request initial metrics
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
    ip_address_update: (data) => {
      if (data && data.ip_address) {
        setIpAddress(data.ip_address);
      }
    },
    error: (data) => {
      console.error('IP fetcher error:', data.message);
    },
    onConnect: () => {
      console.log('IP socket connected');
      // Request current IP
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

  // Initialize charts when components mount
  useEffect(() => {
    if (cpuChartRef.current && ramChartRef.current) {
      createCharts();
    }

    return () => {
      if (cpuChart.current) {
        cpuChart.current.destroy();
        cpuChart.current = null;
      }
      if (ramChart.current) {
        ramChart.current.destroy();
        ramChart.current = null;
      }
    };
  }, []);

  const createCharts = () => {
    const cpuCtx = cpuChartRef.current.getContext('2d');
    const ramCtx = ramChartRef.current.getContext('2d');

    // CPU Chart
    cpuChart.current = new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'CPU Usage (%)',
          data: [],
          borderColor: 'rgba(106, 167, 248, 1)',
          borderWidth: 2,
          fill: {
            target: 'origin',
            above: 'rgba(106, 167, 248, 0.25)',
          },
          pointRadius: 0,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            type: 'time',
            time: {
              unit: 'second',
              tooltipFormat: 'HH:mm:ss',
              displayFormats: {
                second: 'HH:mm:ss'
              }
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // RAM Chart
    ramChart.current = new Chart(ramCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'RAM Usage (%)',
          data: [],
          borderColor: 'rgba(246, 89, 33, 1)',
          borderWidth: 2,
          fill: {
            target: 'origin',
            above: 'rgba(246, 89, 33, 0.25)',
          },
          pointRadius: 0,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            type: 'time',
            time: {
              unit: 'second',
              tooltipFormat: 'HH:mm:ss',
              displayFormats: {
                second: 'HH:mm:ss'
              }
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  };

  const updateChart = (chart, value, type) => {
    if (!chart) return;

    const currentTime = new Date();
    chart.data.labels.push(currentTime);
    chart.data.datasets[0].data.push(value);

    // Keep last 30 data points (1 minute of data with 2-second intervals)
    if (chart.data.labels.length > 30) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    chart.update('none'); // Use 'none' mode for better performance
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Monitoring Section */}
      <div className="flex flex-wrap gap-8">
        {/* CPU Usage Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">CPU Usage</h2>
          <p className="mt-2 text-cpuChartColor text-center">{cpuUsage}</p>
          <div className="h-64">
            <canvas ref={cpuChartRef}></canvas>
          </div>
        </div>

        {/* RAM Usage Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">RAM Usage</h2>
          <p className="mt-2 text-ramChartColor text-center">{ramUsage}</p>
          <div className="h-64">
            <canvas ref={ramChartRef}></canvas>
          </div>
        </div>

        {/* Running Services Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">Running Services</h2>
          <div className="h-64 overflow-hidden rounded-lg border border-accentBoarder">
            <CustomScrollbar>
              <div className="h-full">
                <ul className="list-none text-sm m-0 p-0">
                  {services.length > 0 ? (
                    services.map((service) => (
                      <li
                        key={service.pid}
                        className="p-4 hover:bg-buttonColor transition-colors duration-200 text-textSecondary border-b border-accentBoarder last:border-b-0"
                      >
                        {service.name} (PID: {service.pid})
                      </li>
                    ))
                  ) : (
                    <li className="p-4 text-textSecondary">Loading services...</li>
                  )}
                </ul>
              </div>
            </CustomScrollbar>
          </div>
        </div>

        {/* IP Address Section */}
        <div className="flex-1 flex items-start max-w-md">
          <div className="bg-cardBg px-6 py-4 rounded-lg shadow-lg text-white w-full border border-accentBoarder min-w-[28rem]">
            <h2 className="text-base mb-2">IP Address</h2>
            <p className="text-center">{ipAddress}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 