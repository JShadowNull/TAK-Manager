# backend/services/scripts/system_monitor.py

import psutil
from backend.routes.socketio import socketio
from backend.services.helpers.os_detector import OSDetector
import eventlet

class SystemMonitor:
    def __init__(self, app):
        self.app = app
        self.os_detector = OSDetector()

    def emit_cpu_usage(self):
        with self.app.app_context():
            cpu_usage = psutil.cpu_percent(interval=None)  # Non-blocking
            socketio.emit('cpu_usage', {'cpu_usage': cpu_usage}, namespace='/services-monitor')

    def emit_ram_usage(self):
        with self.app.app_context():
            ram_usage = psutil.virtual_memory().percent
            socketio.emit('ram_usage', {'ram_usage': ram_usage}, namespace='/services-monitor')

    def emit_services(self):
        with self.app.app_context():
            services = []
            os_type = self.os_detector.detect_os()
            for proc in psutil.process_iter(['pid', 'name', 'status', 'username', 'ppid']):
                if proc.is_running() and proc.status() == psutil.STATUS_RUNNING and self.is_user_process(proc, os_type):
                    services.append({'pid': proc.info['pid'], 'name': proc.info['name']})
            socketio.emit('services', {'services': services}, namespace='/services-monitor')

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

    def run_monitor(self):
        while True:
            self.emit_cpu_usage()
            self.emit_ram_usage()
            self.emit_services()
            eventlet.sleep(2)  # Use eventlet.sleep instead of time.sleep

def start_system_monitor(app):
    monitor = SystemMonitor(app)
    socketio.start_background_task(monitor.run_monitor)
