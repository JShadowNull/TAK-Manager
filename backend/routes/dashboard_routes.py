# backend/routes/dashboard_routes.py

from flask import Blueprint
from flask_socketio import Namespace
from backend.services.scripts.system.system_monitor import SystemMonitor
from backend.routes.socketio import socketio
from backend.services.helpers.get_ip import IPFetcher
from backend.services.scripts.system.thread_manager import ThreadManager
import eventlet
import psutil

# Initialize thread manager
thread_manager = ThreadManager()

dashboard_bp = Blueprint('dashboard', __name__)

# Services Monitor Namespace
class ServicesMonitorNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.system_monitor = SystemMonitor()
        self.monitor_thread = None
        self.operation_threads = []

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        # Remove dead threads
        self.operation_threads = [t for t in self.operation_threads if not t.dead]
        # Kill any remaining threads that are still alive
        for thread in self.operation_threads:
            try:
                if not thread.dead:
                    thread.kill()
            except Exception as e:
                print(f"Error killing thread: {e}")
        self.operation_threads = []

    def monitor_system_with_initial_data(self):
        """Monitor system with initial data emission"""
        try:
            print("Starting system monitoring with initial data")
            # Get initial CPU usage to establish baseline
            psutil.cpu_percent(interval=None)
            eventlet.sleep(0.1)  # Short delay for accurate initial reading
            
            # Get and emit initial data
            metrics = self.system_monitor.get_current_metrics()
            print(f"Initial metrics: {metrics}")
            
            # Emit each metric with a small delay to prevent congestion
            socketio.emit('cpu_usage', {'cpu_usage': metrics['cpu']}, namespace='/services-monitor')
            eventlet.sleep(0.1)
            
            socketio.emit('ram_usage', {'ram_usage': metrics['ram']}, namespace='/services-monitor')
            eventlet.sleep(0.1)
            
            socketio.emit('services', {'services': metrics['services']}, namespace='/services-monitor')
            
            # Start regular monitoring
            self.system_monitor.monitor_system()
        except Exception as e:
            print(f"Error in monitor_system_with_initial_data: {e}")
            # Emit error to client
            socketio.emit('error', {'message': str(e)}, namespace='/services-monitor')

    def on_connect(self):
        print('Client connected to /services-monitor namespace')
        try:
            if not self.monitor_thread or self.monitor_thread.dead:
                # Use thread_manager to spawn the monitor thread with initial data
                self.monitor_thread = thread_manager.spawn(self.monitor_system_with_initial_data)
                self.operation_threads.append(self.monitor_thread)
            else:
                # If thread exists and is alive, just send current data
                metrics = self.system_monitor.get_current_metrics()
                socketio.emit('cpu_usage', {'cpu_usage': metrics['cpu']}, namespace='/services-monitor')
                eventlet.sleep(0.1)
                socketio.emit('ram_usage', {'ram_usage': metrics['ram']}, namespace='/services-monitor')
                eventlet.sleep(0.1)
                socketio.emit('services', {'services': metrics['services']}, namespace='/services-monitor')
        except Exception as e:
            print(f"Error in on_connect: {e}")
            socketio.emit('error', {'message': str(e)}, namespace='/services-monitor')

    def on_disconnect(self):
        print('Client disconnected from /services-monitor namespace')
        try:
            if self.system_monitor:
                self.system_monitor.stop_monitoring()
            self.cleanup_operation_threads()
            # Kill the monitor thread if it exists
            if self.monitor_thread and not self.monitor_thread.dead:
                self.monitor_thread.kill()
            self.monitor_thread = None
        except Exception as e:
            print(f"Error in on_disconnect: {e}")

    def on_request_metrics(self, data=None):
        """Handle manual metrics request"""
        print("Received request_metrics event")
        try:
            metrics = self.system_monitor.get_current_metrics()
            print(f"Sending metrics on request: {metrics}")
            socketio.emit('cpu_usage', {'cpu_usage': metrics['cpu']}, namespace='/services-monitor')
            eventlet.sleep(0.1)
            socketio.emit('ram_usage', {'ram_usage': metrics['ram']}, namespace='/services-monitor')
            eventlet.sleep(0.1)
            socketio.emit('services', {'services': metrics['services']}, namespace='/services-monitor')
        except Exception as e:
            print(f"Error in request_metrics: {e}")
            socketio.emit('error', {'message': str(e)}, namespace='/services-monitor')

# IP Fetcher Namespace
class IPFetcherNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.ip_fetcher = IPFetcher()
        self.monitor_thread = None
        self.operation_threads = []

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        # Remove dead threads
        self.operation_threads = [t for t in self.operation_threads if not t.dead]
        # Kill any remaining threads that are still alive
        for thread in self.operation_threads:
            try:
                if not thread.dead:
                    thread.kill()
            except Exception as e:
                print(f"Error killing thread: {e}")
        self.operation_threads = []

    def monitor_ip_with_initial_data(self):
        """Monitor IP with initial data emission"""
        try:
            # Send initial IP immediately
            initial_ip = self.ip_fetcher.get_ip_address()
            socketio.emit('ip_address_update', {'ip_address': initial_ip}, namespace='/ip-fetcher')
            
            # Then start regular monitoring
            self.ip_fetcher.monitor_ip()
        except Exception as e:
            print(f"Error in monitor_ip_with_initial_data: {e}")

    def on_connect(self):
        print('Client connected to /ip-fetcher namespace')
        if not self.monitor_thread:
            # Use thread_manager to spawn the monitor thread with initial data
            self.monitor_thread = thread_manager.spawn(self.monitor_ip_with_initial_data)
            self.operation_threads.append(self.monitor_thread)
        else:
            # If thread exists, just send current IP
            try:
                current_ip = self.ip_fetcher.get_ip_address()
                socketio.emit('ip_address_update', {'ip_address': current_ip}, namespace='/ip-fetcher')
            except Exception as e:
                print(f"Error sending current IP: {e}")

    def on_disconnect(self):
        print('Client disconnected from /ip-fetcher namespace')
        if self.ip_fetcher:
            self.ip_fetcher.stop_monitoring()
        self.cleanup_operation_threads()
        # Kill the monitor thread if it exists
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def on_get_ip_address(self):
        """Handle manual IP address request"""
        try:
            ip_address = self.ip_fetcher.get_ip_address()
            socketio.emit('ip_address_update', {'ip_address': ip_address}, namespace='/ip-fetcher')
        except Exception as e:
            print(f"Error getting IP address: {e}")
            socketio.emit('error', {'message': str(e)}, namespace='/ip-fetcher')

# Register the namespaces
socketio.on_namespace(ServicesMonitorNamespace('/services-monitor'))
socketio.on_namespace(IPFetcherNamespace('/ip-fetcher'))

@dashboard_bp.route('/dashboard', methods=['GET'])
def dashboard():
    return '', 200
