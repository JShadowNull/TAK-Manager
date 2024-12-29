# server/backend/services/scripts/system/system_monitor.py

import psutil
from backend.routes.socketio import socketio, safe_emit
from backend import create_app
import eventlet
import logging
import docker
import time

# Configure logger
logger = logging.getLogger(__name__)

class SystemMonitor:
    def __init__(self):
        self.monitoring = False
        self.docker_client = docker.from_env()
        logger.info("SystemMonitor initialized")

    def calculate_total_metrics(self) -> tuple:
        """Calculate total CPU and RAM metrics from all running containers"""
        try:
            total_cpu = 0
            total_ram = 0
            
            for container in self.docker_client.containers.list():
                stats = container.stats(stream=False)  # Get a single stats snapshot
                
                # Calculate CPU
                if all(key in stats for key in ['cpu_stats', 'precpu_stats']):
                    cpu_stats = stats['cpu_stats']
                    precpu_stats = stats['precpu_stats']
                    
                    if all(key in cpu_stats for key in ['cpu_usage', 'system_cpu_usage', 'online_cpus']) and \
                       all(key in precpu_stats for key in ['cpu_usage', 'system_cpu_usage']):
                        
                        cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
                        system_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
                        num_cpus = cpu_stats['online_cpus']
                        
                        if system_delta > 0:
                            container_cpu = (cpu_delta / system_delta) * num_cpus * 100.0
                            total_cpu += container_cpu

                # Calculate RAM
                if 'memory_stats' in stats:
                    memory_stats = stats['memory_stats']
                    if all(key in memory_stats for key in ['usage', 'limit']):
                        mem_usage = memory_stats['usage']
                        if 'cache' in memory_stats:
                            mem_usage -= memory_stats['cache']
                        mem_limit = memory_stats['limit']
                        if mem_limit > 0:
                            container_ram = (mem_usage / mem_limit) * 100.0
                            total_ram += container_ram

            return round(total_cpu, 2), round(total_ram, 2)
        except Exception as e:
            logger.error(f"Error calculating total metrics: {str(e)}")
            return 0, 0

    def monitor_system(self):
        """Monitor system metrics"""
        try:
            logger.info("Starting system monitoring")
            self.monitoring = True
            
            while self.monitoring:
                cpu, ram = self.calculate_total_metrics()
                metrics = {
                    'cpu': cpu,
                    'ram': ram
                }
                safe_emit('system_metrics', metrics, namespace='/services-monitor')
                eventlet.sleep(2)  # Update every 2 seconds
                
        except Exception as e:
            logger.error(f"Error in system monitoring: {str(e)}")
        finally:
            logger.info("System monitoring stopped")

    def stop_monitoring(self):
        """Stop the monitoring system"""
        logger.info("Stopping system monitoring")
        self.monitoring = False

if __name__ == '__main__':
    app = create_app()
    monitor = SystemMonitor()
    socketio.run(app)
