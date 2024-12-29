# backend/routes/dashboard_routes.py

from flask import Blueprint
from flask_socketio import Namespace
from backend.services.scripts.system.system_monitor import SystemMonitor
from backend.routes.socketio import socketio, safe_emit
from backend.services.helpers.get_ip import IPFetcher
from backend.services.scripts.system.thread_manager import ThreadManager
import eventlet
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Initialize thread manager
thread_manager = ThreadManager()

dashboard_bp = Blueprint('dashboard', __name__)

# Services Monitor Namespace
class ServicesMonitorNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.system_monitor = SystemMonitor()
        self.monitor_thread = None

    def get_initial_status(self):
        """Get initial system status"""
        return {
            'cpuData': [],
            'ramData': [],
            'cpu': 0,
            'ram': 0
        }

    def start_monitoring(self):
        """Start the monitoring system"""
        if not self.monitor_thread or self.monitor_thread.dead:
            logger.info("Starting system monitoring...")
            self.monitor_thread = thread_manager.spawn(self.system_monitor.monitor_system)

    def stop_monitoring(self):
        """Stop the monitoring system"""
        try:
            if self.system_monitor:
                self.system_monitor.stop_monitoring()
            if self.monitor_thread and not self.monitor_thread.dead:
                self.monitor_thread.kill()
            self.monitor_thread = None
        except Exception as e:
            logger.error(f"Error stopping monitoring: {e}")

    def on_connect(self):
        logger.info('Client connected to /services-monitor namespace')
        try:
            self.start_monitoring()
        except Exception as e:
            logger.error(f"Error in on_connect: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/services-monitor')

    def on_request_initial_state(self):
        """Handle request for initial state"""
        try:
            initial_status = self.get_initial_status()
            safe_emit('initial_state', initial_status, namespace='/services-monitor')
        except Exception as e:
            logger.error(f"Error in request_initial_state: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/services-monitor')

    def on_disconnect(self):
        logger.info('Client disconnected from /services-monitor namespace')
        try:
            self.stop_monitoring()
        except Exception as e:
            logger.error(f"Error in on_disconnect: {e}")

# IP Fetcher Namespace
class IPFetcherNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.ip_fetcher = IPFetcher()
        self.monitor_thread = None
        self.operation_threads = []

    def get_initial_status(self):
        """Get initial network status"""
        try:
            metrics = self.ip_fetcher.get_metrics()
            return {
                'ip_address': metrics.get('ip_address', 'Unknown'),
                'network': metrics.get('network', {
                    'upload': 0,
                    'download': 0,
                    'total': 0
                })
            }
        except Exception as e:
            print(f"Error getting initial network status: {e}")
            return {
                'ip_address': 'Unknown',
                'network': {
                    'upload': 0,
                    'download': 0,
                    'total': 0
                }
            }

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        self.operation_threads = [t for t in self.operation_threads if not t.dead]
        for thread in self.operation_threads:
            try:
                if not thread.dead:
                    thread.kill()
            except Exception as e:
                print(f"Error killing thread: {e}")
        self.operation_threads = []

    def monitor_network_with_initial_data(self):
        """Monitor network metrics with initial data emission"""
        try:
            # Send initial metrics immediately
            initial_status = self.get_initial_status()
            safe_emit('initial_state', initial_status, namespace='/ip-fetcher')
            safe_emit('network_metrics', initial_status, namespace='/ip-fetcher')
            
            # Then start regular monitoring
            self.ip_fetcher.monitor_ip()
        except Exception as e:
            print(f"Error in monitor_network_with_initial_data: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/ip-fetcher')

    def on_connect(self):
        print('Client connected to /ip-fetcher namespace')
        try:
            if not self.monitor_thread or self.monitor_thread.dead:
                self.monitor_thread = thread_manager.spawn(self.monitor_network_with_initial_data)
                self.operation_threads.append(self.monitor_thread)
            else:
                # If thread exists, send current metrics
                initial_status = self.get_initial_status()
                safe_emit('initial_state', initial_status, namespace='/ip-fetcher')
                safe_emit('network_metrics', initial_status, namespace='/ip-fetcher')
        except Exception as e:
            print(f"Error in on_connect: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/ip-fetcher')

    def on_request_initial_state(self):
        """Handle request for initial state"""
        try:
            initial_status = self.get_initial_status()
            safe_emit('initial_state', initial_status, namespace='/ip-fetcher')
        except Exception as e:
            print(f"Error in request_initial_state: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/ip-fetcher')

    def on_disconnect(self):
        print('Client disconnected from /ip-fetcher namespace')
        try:
            if self.ip_fetcher:
                self.ip_fetcher.stop_monitoring()
            self.cleanup_operation_threads()
            if self.monitor_thread and not self.monitor_thread.dead:
                self.monitor_thread.kill()
            self.monitor_thread = None
        except Exception as e:
            print(f"Error in on_disconnect: {e}")

    def on_get_ip_address(self):
        """Handle manual metrics request"""
        try:
            metrics = self.ip_fetcher.get_metrics()
            safe_emit('network_metrics', metrics, namespace='/ip-fetcher')
        except Exception as e:
            print(f"Error getting network metrics: {e}")
            safe_emit('error', {'message': str(e)}, namespace='/ip-fetcher')

# Register the namespaces
socketio.on_namespace(ServicesMonitorNamespace('/services-monitor'))
socketio.on_namespace(IPFetcherNamespace('/ip-fetcher'))

@dashboard_bp.route('/dashboard', methods=['GET'])
def dashboard():
    return '', 200
