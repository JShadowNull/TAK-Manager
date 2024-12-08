import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
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
  const socketRef = useRef(null);
  const ipSocketRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.IO connections
    socketRef.current = io('/services-monitor', { 
      transports: ['websocket']
    });

    ipSocketRef.current = io('/ip-fetcher', { 
      transports: ['websocket']
    });

    // Create charts
    createCharts();

    // Services monitor socket event listeners
    socketRef.current.on('connect', () => {
      console.log('Services monitor socket connected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Services monitor socket connection error:', error);
    });

    socketRef.current.on('cpu_usage', (data) => {
      updateChart(cpuChart.current, data.cpu_usage, 'cpu');
      saveChartData('cpuData', cpuChart.current.data.datasets[0].data);
    });

    socketRef.current.on('ram_usage', (data) => {
      updateChart(ramChart.current, data.ram_usage, 'ram');
      saveChartData('ramData', ramChart.current.data.datasets[0].data);
    });

    socketRef.current.on('services', (data) => {
      updateServicesList(data.services);
    });

    // IP fetcher socket event listeners
    ipSocketRef.current.on('connect', () => {
      console.log('IP socket connected');
    });

    ipSocketRef.current.on('connect_error', (error) => {
      console.error('IP socket connection error:', error);
    });

    ipSocketRef.current.on('ip_address_update', (data) => {
      console.log('Received IP update:', data.ip_address);
      updateIpAddress(data.ip_address);
    });

    // Cleanup function
    return () => {
      // Cleanup charts
      if (cpuChart.current) {
        cpuChart.current.destroy();
        cpuChart.current = null;
      }
      if (ramChart.current) {
        ramChart.current.destroy();
        ramChart.current = null;
      }

      // Cleanup sockets
      if (socketRef.current) {
        console.log('Disconnecting services monitor socket');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (ipSocketRef.current) {
        console.log('Disconnecting IP fetcher socket');
        ipSocketRef.current.removeAllListeners();
        ipSocketRef.current.disconnect();
        ipSocketRef.current = null;
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
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          },
          x: {
            type: 'time',
            display: false,
            time: {
              tooltipFormat: 'MMM d, h:mm:ss a',
            }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(tooltipItem) {
                const value = tooltipItem.raw;
                const time = tooltipItem.label;
                const formattedTime = new Date(time).toLocaleTimeString();
                return `Time: ${formattedTime}, Usage: ${value}%`;
              }
            }
          }
        },
        hover: {
          mode: 'index',
          intersect: false
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
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          },
          x: {
            type: 'time',
            display: false,
            time: {
              tooltipFormat: 'MMM d, h:mm:ss a',
            }
          }
        },
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(tooltipItem) {
                const value = tooltipItem.raw;
                const time = tooltipItem.label;
                const formattedTime = new Date(time).toLocaleTimeString();
                return `Time: ${formattedTime}, Usage: ${value}%`;
              }
            }
          }
        },
        hover: {
          mode: 'index',
          intersect: false
        }
      }
    });
  };

  const updateChart = (chart, value, elementId) => {
    const currentTime = new Date();
    chart.data.labels.push(currentTime);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > 1000) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    document.getElementById(elementId).textContent = value + '%';
    chart.update();
    saveChartData('chartLabels', chart.data.labels);
  };

  const updateServicesList = (services) => {
    const servicesList = document.getElementById('services');
    if (!servicesList) return;

    servicesList.innerHTML = '';
    services.forEach(service => {
      const listItem = document.createElement('li');
      listItem.textContent = `${service.name} (PID: ${service.pid})`;
      listItem.className = 'p-4 rounded-lg hover:bg-buttonColor transition-colors duration-200 text-textSecondary border border-transparent hover:border-accentBoarder';
      servicesList.appendChild(listItem);
    });
  };

  const updateIpAddress = (ipAddress) => {
    const ipElement = document.getElementById('ip-address');
    if (ipElement) {
      ipElement.textContent = ipAddress;
    }
  };

  const saveChartData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Monitoring Section */}
      <div className="flex flex-wrap gap-8">
        {/* CPU Usage Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">CPU Usage</h2>
          <p id="cpu" className="mt-2 text-cpuChartColor text-center">Loading...</p>
          <canvas ref={cpuChartRef} className="mt-4 text-textSecondary"></canvas>
        </div>

        {/* RAM Usage Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">RAM Usage</h2>
          <p id="ram" className="mt-2 text-ramChartColor text-center">Loading...</p>
          <canvas ref={ramChartRef} className="mt-4"></canvas>
        </div>

        {/* Running Services Section */}
        <div className="flex-1 bg-cardBg p-6 rounded-lg shadow-lg text-white max-w-md border border-accentBoarder min-w-[28rem]">
          <h2 className="text-base mb-4">Running Services</h2>
          <div className="h-64 overflow-hidden rounded-lg border border-accentBoarder">
            <CustomScrollbar>
              <div className="h-full">
                <ul id="services" className="list-none text-sm m-0 p-0">
                  <li className="p-4 hover:bg-buttonColor transition-colors duration-200 text-textSecondary border-b border-accentBoarder last:border-b-0">
                    Loading...
                  </li>
                </ul>
              </div>
            </CustomScrollbar>
          </div>
        </div>

        {/* IP Address Section */}
        <div className="flex-1 flex items-start max-w-md">
          <div className="bg-cardBg px-6 py-4 rounded-lg shadow-lg text-white w-full border border-accentBoarder min-w-[28rem]">
            <h2 className="text-base mb-2">IP Address</h2>
            <p id="ip-address" className="text-center">Loading...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 