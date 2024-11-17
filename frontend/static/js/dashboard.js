// frontend/static/js/dashboard.js

// Define the createCharts function
function createCharts() {
    const ctxCpu = document.getElementById('cpu-graph').getContext('2d');
    const ctxRam = document.getElementById('ram-graph').getContext('2d');

    // Initialize the CPU Chart
    cpuChart = new Chart(ctxCpu, {
        type: 'line',
        data: {
            labels: [],  // Time labels
            datasets: [{
                label: 'CPU Usage (%)',
                data: [],  // Data to be dynamically added
                borderColor: 'rgba(106, 167, 248, 1)',
                borderWidth: 2,
                fill: {
                    target: 'origin',
                    above: 'rgba(106, 167, 248, 0.25)', // Fill area
                },
                pointRadius: 0,  // Hide all points (no dots)
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100  // Maximum value for the y-axis
                },
                x: {
                    type: 'time',  // Time-based scaling with date-fns
                    display: false,  // Hide the x-axis timestamps entirely
                    time: {
                        tooltipFormat: 'MMM d, h:mm:ss a',  // Tooltip format for time
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',  // Display tooltip when hovering near any point
                    intersect: false,  // Don't require an exact match to trigger tooltip
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
                mode: 'index',  // Allow hover to trigger tooltip across the nearest point
                intersect: false  // Trigger even if not exactly over a point
            }
        }
    });

    // Initialize the RAM Chart
    ramChart = new Chart(ctxRam, {
        type: 'line',
        data: {
            labels: [],  // Time labels
            datasets: [{
                label: 'RAM Usage (%)',
                data: [],  // Data to be dynamically added
                borderColor: 'rgba(246, 89, 33, 1)',
                borderWidth: 2,
                fill: {
                    target: 'origin',
                    above: 'rgba(246, 89, 33, 0.25)', // Fill area
                },
                pointRadius: 0,  // Hide all points (no dots)
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100  // Maximum value for the y-axis
                },
                x: {
                    type: 'time',  // Time-based scaling with date-fns
                    display: false,  // Hide the x-axis timestamps entirely
                    time: {
                        tooltipFormat: 'MMM d, h:mm:ss a',  // Tooltip format for time
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',  // Display tooltip when hovering near any point
                    intersect: false,  // Don't require an exact match to trigger tooltip
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
                mode: 'index',  // Allow hover to trigger tooltip across the nearest point
                intersect: false  // Trigger even if not exactly over a point
            }
        }
    });
}

// Call createCharts to initialize the charts
createCharts();

// Establish WebSocket connection using Socket.IO for the services-monitor namespace
const servicesSocket = io('/services-monitor', { transports: ['websocket'] });

// Listen for CPU usage updates from the server
servicesSocket.on('cpu_usage', function (data) {
    updateChart(cpuChart, data.cpu_usage, 'cpu');
    saveChartData('cpuData', cpuChart.data.datasets[0].data);
});

// Listen for RAM usage updates from the server
servicesSocket.on('ram_usage', function (data) {
    updateChart(ramChart, data.ram_usage, 'ram');
    saveChartData('ramData', ramChart.data.datasets[0].data);
});

// Listen for services updates from the server
servicesSocket.on('services', function (data) {
    updateServicesList(data.services);
});

// Listen for IP address updates from the server
const ipSocket = io('/ip-fetcher', { transports: ['websocket'] });
ipSocket.emit('get_ip_address');  // Emit event to request IP address
ipSocket.on('ip_address_update', function (data) {
    updateIpAddress(data.ip_address);
});

// Function to update chart data and DOM element for CPU/RAM
function updateChart(chart, value, elementId) {
    const currentTime = new Date();

    // Add data point for every second
    chart.data.labels.push(currentTime);  // Push the current time as a Date object
    chart.data.datasets[0].data.push(value);

    // Remove excess data points if needed (optional to limit data size)
    if (chart.data.labels.length > 1000) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    // Update the UI element for the current value
    document.getElementById(elementId).textContent = value + '%';
    chart.update();

    // Save the labels and chart data to localStorage
    saveChartData('chartLabels', chart.data.labels);
}

// Function to update the services list
function updateServicesList(services) {
    const servicesList = document.getElementById('services');
    servicesList.innerHTML = '';
    services.forEach(service => {
        const listItem = document.createElement('li');
        listItem.textContent = `${service.name} (PID: ${service.pid})`;
        servicesList.appendChild(listItem);
    });
}

// Function to update the IP address display
function updateIpAddress(ipAddress) {
    const ipElement = document.getElementById('ip-address');
    if (ipElement) {
        ipElement.textContent = ipAddress;
    } else {
        console.error('IP address element not found');
    }
}

// Helper functions to save and load data from localStorage
function saveChartData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadChartData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}
