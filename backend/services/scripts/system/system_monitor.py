# backend/services/scripts/system/system_monitor.py

import psutil
from backend.routes.socketio import socketio
from backend.services.helpers.os_detector import OSDetector
import eventlet

class SystemMonitor:
    def __init__(self):
        self.os_detector = OSDetector()
        self.monitoring = False

    def get_cpu_usage(self):
        """Get current CPU usage percentage"""
        return psutil.cpu_percent(interval=None)  # Non-blocking

    def get_ram_usage(self):
        """Get current RAM usage percentage"""
        return psutil.virtual_memory().percent

    def get_services(self):
        """Get list of running services"""
        services = []
        os_type = self.os_detector.detect_os()
        for proc in psutil.process_iter(['pid', 'name', 'status', 'username', 'ppid']):
            if proc.is_running() and proc.status() == psutil.STATUS_RUNNING and self.is_user_process(proc, os_type):
                services.append({'pid': proc.info['pid'], 'name': proc.info['name']})
        return services

    def monitor_system(self):
        """Monitor system metrics and emit updates"""
        self.monitoring = True
        while self.monitoring:
            try:
                # Emit CPU usage
                cpu_usage = self.get_cpu_usage()
                socketio.emit('cpu_usage', {'cpu_usage': cpu_usage}, namespace='/services-monitor')

                # Emit RAM usage
                ram_usage = self.get_ram_usage()
                socketio.emit('ram_usage', {'ram_usage': ram_usage}, namespace='/services-monitor')

                # Emit services list
                services = self.get_services()
                socketio.emit('services', {'services': services}, namespace='/services-monitor')

                eventlet.sleep(2)  # Update every 2 seconds
            except Exception as e:
                print(f"Error monitoring system: {e}")
                eventlet.sleep(2)

    def stop_monitoring(self):
        """Stop the system monitoring"""
        self.monitoring = False

    def is_user_process(self, proc, os_type):
        if os_type == 'windows':
            return self.is_user_process_windows(proc)
        elif os_type == 'macos':
            return self.is_user_process_macos(proc)
        elif os_type == 'linux':
            return self.is_user_process_linux(proc)
        return False

    def is_user_process_macos(self, proc):
        # macOS-specific process filtering logic
        system_parents = ['launchd', 'kernel_task']
        system_processes = ['WindowServer', 'kernel_task', 'hidd', 'configd']

        if proc.info['name'] not in system_processes and not self.is_system_parent(proc, system_parents):
            return True
        return False

    def is_system_parent(self, proc, parent_process_names):
        """
        Checks if the parent process of a given process is a system process.
        This helps to exclude system-related processes from the list of services.
        """
        try:
            parent = psutil.Process(proc.info['ppid'])  # Get the parent process
            return parent.name().lower() in parent_process_names
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False
