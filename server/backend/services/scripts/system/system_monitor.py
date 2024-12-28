# backend/services/scripts/system/system_monitor.py

import psutil
from backend.routes.socketio import socketio
from backend.services.helpers.os_detector import OSDetector
import eventlet
import logging

class SystemMonitor:
    def __init__(self):
        self.os_detector = OSDetector()
        self.monitoring = False

    def get_cpu_usage(self):
        """Get current CPU usage percentage"""
        try:
            usage = psutil.cpu_percent(interval=None)
            if usage is None:
                return 0
            return usage
        except Exception:
            return 0

    def get_ram_usage(self):
        """Get current RAM usage percentage"""
        try:
            memory = psutil.virtual_memory()
            usage = memory.percent
            return usage
        except Exception:
            return 0

    def get_services(self):
        """Get list of running services"""
        try:
            services = []
            os_type = self.os_detector.detect_os()
            
            for proc in psutil.process_iter(['pid', 'name', 'status', 'username', 'ppid']):
                try:
                    if proc.is_running() and proc.status() == psutil.STATUS_RUNNING:
                        if self.is_user_process(proc, os_type):
                            services.append({'pid': proc.info['pid'], 'name': proc.info['name']})
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
                
            return services
        except Exception:
            return []

    def get_current_metrics(self):
        """Get current system metrics"""
        try:
            # Get CPU usage first to ensure accuracy
            cpu = self.get_cpu_usage()
            
            # Get RAM usage
            ram = self.get_ram_usage()
            
            # Get services
            services = self.get_services()
            
            metrics = {
                'cpu': cpu,
                'ram': ram,
                'services': services
            }
            return metrics
        except Exception:
            return {'cpu': 0, 'ram': 0, 'services': []}

    def monitor_system(self):
        """Monitor system metrics and emit updates"""
        self.monitoring = True
        
        # Get initial CPU usage to establish baseline
        initial_cpu = psutil.cpu_percent(interval=None)
        eventlet.sleep(0.1)  # Short delay for accurate initial reading
        
        iteration = 0
        while self.monitoring:
            try:
                iteration += 1
                
                metrics = self.get_current_metrics()
                
                # Emit CPU usage
                socketio.emit('cpu_usage', {'cpu_usage': metrics['cpu']}, namespace='/services-monitor')
                eventlet.sleep(0.1)
                
                # Emit RAM usage
                socketio.emit('ram_usage', {'ram_usage': metrics['ram']}, namespace='/services-monitor')
                eventlet.sleep(0.1)
                
                # Emit services
                socketio.emit('services', {'services': metrics['services']}, namespace='/services-monitor')
                
                eventlet.sleep(1.8)  # Adjust remaining sleep time to maintain ~2 second total interval
            except Exception:
                eventlet.sleep(2)

    def stop_monitoring(self):
        """Stop the system monitoring"""
        was_monitoring = self.monitoring
        self.monitoring = False

    def is_user_process(self, proc, os_type):
        if os_type == 'windows':
            result = self.is_user_process_windows(proc)
        elif os_type == 'macos':
            result = self.is_user_process_macos(proc)
        elif os_type == 'linux':
            result = self.is_user_process_linux(proc)
        else:
            result = False
        return result

    def is_user_process_macos(self, proc):
        # macOS-specific process filtering logic
        system_parents = ['launchd', 'kernel_task']
        system_processes = ['WindowServer', 'kernel_task', 'hidd', 'configd']
        
        try:
            is_system_proc = proc.info['name'] in system_processes
            has_system_parent = self.is_system_parent(proc, system_parents)
            
            if not is_system_proc and not has_system_parent:
                return True
            return False
        except Exception:
            return False

    def is_system_parent(self, proc, parent_process_names):
        """
        Checks if the parent process of a given process is a system process.
        This helps to exclude system-related processes from the list of services.
        """
        try:
            parent = psutil.Process(proc.info['ppid'])
            is_system = parent.name().lower() in parent_process_names
            return is_system
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False
