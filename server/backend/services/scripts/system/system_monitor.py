# backend/services/scripts/system/system_monitor.py

import psutil
from backend.routes.socketio import socketio
import eventlet
import logging
import docker

class SystemMonitor:
    def __init__(self):
        self.monitoring = False
        self.docker_client = docker.from_env()

    def get_cpu_usage(self):
        """Get current CPU usage percentage of the host"""
        try:
            stats = self.docker_client.api.get_info()
            ncpu = stats['NCPU']
            
            # Get host CPU usage by reading from /proc/stat through privileged mode
            with open('/host/proc/stat', 'r') as f:
                cpu_stats = f.readline().split()
                total = sum(float(x) for x in cpu_stats[1:])
                idle = float(cpu_stats[4])
                usage = 100 * (1 - idle / total)
                
            return usage
        except Exception as e:
            logging.error(f"Error getting CPU usage: {str(e)}")
            return 0

    def get_ram_usage(self):
        """Get current RAM usage percentage of the host"""
        try:
            with open('/host/proc/meminfo', 'r') as f:
                lines = f.readlines()
                mem_info = {}
                for line in lines:
                    key, value = line.split(':')
                    value = value.strip().split()[0]  # Remove 'kB' and convert to int
                    mem_info[key] = int(value)
                
                total = mem_info['MemTotal']
                available = mem_info['MemAvailable']
                used = total - available
                usage = (used / total) * 100
                return usage
        except Exception as e:
            logging.error(f"Error getting RAM usage: {str(e)}")
            return 0

    def get_current_metrics(self):
        """Get current system metrics"""
        try:
            # Get CPU usage first to ensure accuracy
            cpu = self.get_cpu_usage()
            
            # Get RAM usage
            ram = self.get_ram_usage()
            
            metrics = {
                'cpu': cpu,
                'ram': ram
            }
            return metrics
        except Exception:
            return {'cpu': 0, 'ram': 0}

    def monitor_system(self):
        """Monitor system metrics and emit updates"""
        self.monitoring = True
        
        # Get initial CPU usage to establish baseline
        self.get_cpu_usage()
        eventlet.sleep(0.1)  # Short delay for accurate initial reading
        
        while self.monitoring:
            try:
                metrics = self.get_current_metrics()
                
                # Emit CPU usage
                socketio.emit('cpu_usage', {'cpu_usage': metrics['cpu']}, namespace='/services-monitor')
                eventlet.sleep(0.1)
                
                # Emit RAM usage
                socketio.emit('ram_usage', {'ram_usage': metrics['ram']}, namespace='/services-monitor')
                
                eventlet.sleep(1.8)  # Adjust remaining sleep time to maintain ~2 second total interval
            except Exception:
                eventlet.sleep(2)

    def stop_monitoring(self):
        """Stop the system monitoring"""
        self.monitoring = False
