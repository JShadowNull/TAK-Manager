# backend/services/socketio_handler.py

from flask_socketio import SocketIO, Namespace
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.scripts.docker.docker_manager import DockerManager
import eventlet
import os

# Initialize SocketIO with eventlet
socketio = SocketIO(
    async_mode='eventlet',
    engineio_logger=True,
    logger=True,
    ping_timeout=60,
    cors_allowed_origins="*",
    path='/socket.io',  # Explicitly set the Socket.IO path
    manage_session=False,  # Disable session management to avoid thread issues
    always_connect=True,  # Allow connections even if initial handshake fails
    max_http_buffer_size=1e8,  # 100MB max http buffer size
    async_handlers=True  # Enable async handlers for better performance
)

def safe_emit(event, data, namespace=None, broadcast=False):
    """Thread-safe emit function using eventlet"""
    try:
        if broadcast:
            socketio.emit(event, data, namespace=namespace)
        else:
            socketio.emit(event, data, namespace=namespace, include_self=True)
    except Exception as e:
        print(f"Error in safe_emit: {e}")

# Docker Installer Socket
from backend.services.helpers.docker_installer import DockerInstaller

# DockerInstallerNamespace handles the Docker installation process
class DockerInstallerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_installer = DockerInstaller()

    def on_connect(self):
        print("Client connected to Docker installer namespace")

    def on_disconnect(self):
        print("Client disconnected from Docker installer namespace")

    def on_check_docker_installed(self):
        print('Received request to check if Docker is installed')
        result = self.docker_installer.is_docker_installed()
        socketio.emit('docker_installed_status', result, namespace='/docker-installer')

# Register the docker installer namespace
socketio.on_namespace(DockerInstallerNamespace('/docker-installer'))

# TAKServer Installer Socket
class TakServerInstallerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_installed = DockerInstaller()

    def on_connect(self):
        print('Client connected to /takserver-installer namespace')

    def on_disconnect(self):
        print('Client disconnected from /takserver-installer namespace')

    def on_check_docker_installed(self):
        print('Received request to check if Docker is installed')
        result = self.docker_installed.is_docker_installed()
        socketio.emit('docker_installed_status', result, namespace='/takserver-installer')

# Register the takserver installer namespace
socketio.on_namespace(TakServerInstallerNamespace('/takserver-installer'))

# OTA Update Socket
class OTAUpdateNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.operation_in_progress = False

    def on_connect(self):
        print('Client connected to /ota-update namespace')
        self.emit_status()

    def on_disconnect(self):
        print('Client disconnected from /ota-update namespace')

    def emit_status(self):
        """Emit current OTA update status"""
        socketio.emit('ota_status', {
            'isUpdating': self.operation_in_progress
        }, namespace='/ota-update')

    def on_check_status(self):
        """Handle status check request"""
        self.emit_status()

# Register the OTA update namespace
socketio.on_namespace(OTAUpdateNamespace('/ota-update'))

# Get IP Address Socket
from backend.services.helpers.get_ip import IPFetcher

class IPFetcherNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.ip_fetcher = IPFetcher()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /ip-fetcher namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.ip_fetcher.monitor_ip)
            thread_manager.add_thread(self.monitor_thread)

    def on_disconnect(self):
        print('Client disconnected from /ip-fetcher namespace')
        if self.ip_fetcher:
            self.ip_fetcher.stop_monitoring()

    def on_get_ip_address(self):
        """Handle manual IP address request"""
        ip_address = self.ip_fetcher.get_ip_address()
        socketio.emit('ip_address_update', {'ip_address': ip_address}, namespace='/ip-fetcher')

# Register the IP fetcher namespace
socketio.on_namespace(IPFetcherNamespace('/ip-fetcher'))

# Services Monitor Namespace
from backend.services.scripts.system.system_monitor import SystemMonitor

class ServicesMonitorNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.system_monitor = SystemMonitor()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /services-monitor namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.system_monitor.monitor_system)
            thread_manager.add_thread(self.monitor_thread)

    def on_disconnect(self):
        print('Client disconnected from /services-monitor namespace')
        if self.system_monitor:
            self.system_monitor.stop_monitoring()

# Register the services monitor namespace
from backend.services.scripts.data_package_config.data_package import DataPackage
socketio.on_namespace(ServicesMonitorNamespace('/services-monitor'))

# Data Package Namespace
class DataPackageNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.data_package = DataPackage()
        self.monitor_thread = None
        self.operation_in_progress = False

    def on_connect(self):
        print('Client connected to /data-package namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_status)
            thread_manager.add_thread(self.monitor_thread)

    def on_disconnect(self):
        print('Client disconnected from /data-package namespace')

    def monitor_status(self):
        """Monitor data package configuration status"""
        while True:
            try:
                if self.operation_in_progress:
                    socketio.emit('data_package_status', {
                        'isConfiguring': True,
                        'status': 'in_progress'
                    }, namespace='/data-package')
            except Exception as e:
                socketio.emit('data_package_error', {
                    'error': str(e)
                }, namespace='/data-package')
            socketio.sleep(2)
            
    def on_get_certificate_files(self):
        """Handle request for certificate files"""
        try:
            cert_files = self.data_package.get_certificate_files()
            socketio.emit('certificate_files', {
                'files': cert_files
            }, namespace='/data-package')
        except Exception as e:
            socketio.emit('data_package_error', {
                'error': f"Error getting certificate files: {str(e)}"
            }, namespace='/data-package')

    def on_get_status(self):
        """Handle status check request"""
        socketio.emit('data_package_status', {
            'isConfiguring': self.operation_in_progress,
            'status': 'in_progress' if self.operation_in_progress else 'idle'
        }, namespace='/data-package')

# Register the data package namespace
socketio.on_namespace(DataPackageNamespace('/data-package'))

from backend.services.scripts.transfer.transfer import RapidFileTransfer
# Transfer Namespace
class TransferNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.rapid_file_transfer = RapidFileTransfer()

    def on_connect(self):
        print('Client connected to /transfer namespace')
        # Start monitoring automatically when client connects
        if not self.rapid_file_transfer.monitoring:
            self.start_monitoring()
        
        # Get current state
        self.on_get_connected_devices()
        self.on_get_transfer_status()

    def on_disconnect(self):
        print('Client disconnected from /transfer namespace')
        # Do not stop monitoring or cleanup here
        # Let the cleanup endpoint handle it based on transfer status

    def start_monitoring(self):
        if not self.rapid_file_transfer.monitoring:
            self.rapid_file_transfer.monitoring = True
            monitor_thread = socketio.start_background_task(
                self.rapid_file_transfer.monitor_devices
            )
            thread_manager.add_thread(monitor_thread)

    def on_get_connected_devices(self):
        """Handle request for current device list"""
        current_devices = [
            {
                'id': did,
                'name': data['name'],
                'status': data['status']
            }
            for did, data in self.rapid_file_transfer.device_states.items()
            if data['state'] == 'device'
        ]
        
        socketio.emit('connected_devices', {
            'devices': current_devices,
            'isTransferRunning': self.rapid_file_transfer.is_transfer_running
        }, namespace='/transfer')

    def on_start_transfer(self):
        # Set transfer running state first
        self.rapid_file_transfer.is_transfer_running = True
        
        # Get list of files to transfer
        files = [f for f in os.listdir(self.rapid_file_transfer.temp_dir) 
                if os.path.isfile(os.path.join(self.rapid_file_transfer.temp_dir, f))]
        
        if not files:
            socketio.emit('terminal_output', {'data': 'No files to transfer'}, namespace='/transfer')
            return
        
        socketio.emit('transfer_status', {
            'isRunning': True,
            'status': 'starting',
            'totalFiles': len(files)
        }, namespace='/transfer')
            
        # Start monitoring if not already running
        if not self.rapid_file_transfer.monitoring:
            self.start_monitoring()
        
        # Start transfer for any currently connected devices
        current_devices = [
            device_id for device_id, data in self.rapid_file_transfer.device_states.items()
            if data['state'] == 'device'
        ]
        
        for device_id in current_devices:
            transfer_thread = socketio.start_background_task(
                self.rapid_file_transfer.start_transfer,
                device_id
            )
            thread_manager.add_thread(transfer_thread)

    def on_stop_transfer(self):
        self.rapid_file_transfer.stop_transfer()

    def on_get_transfer_status(self):
        """Handle transfer status request"""
        self.rapid_file_transfer.get_transfer_status()

# Register the transfer namespace
socketio.on_namespace(TransferNamespace('/transfer'))

from backend.services.scripts.cert_manager.certmanager import CertManager

class CertManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.cert_manager = CertManager()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /cert-manager namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_certificates)
            thread_manager.add_thread(self.monitor_thread)
        # Send immediate update when client connects
        self.get_certificates()

    def on_disconnect(self):
        print('Client disconnected from /cert-manager namespace')

    def monitor_certificates(self):
        """Monitor for certificate changes and emit updates."""
        last_certificates = None
        while True:
            try:
                current_certificates = self.cert_manager.get_registered_certificates()
                if current_certificates != last_certificates:
                    socketio.emit('certificates_data', 
                        {'certificates': current_certificates}, 
                        namespace='/cert-manager'
                    )
                    last_certificates = current_certificates
            except Exception as e:
                socketio.emit('certificates_error', 
                    {'error': str(e)}, 
                    namespace='/cert-manager'
                )
            socketio.sleep(5)

    def get_certificates(self):
        """Handle manual certificate list requests."""
        try:
            certificates = self.cert_manager.get_registered_certificates()
            socketio.emit('certificates_data', 
                {'certificates': certificates}, 
                namespace='/cert-manager'
            )
        except Exception as e:
            socketio.emit('certificates_error', 
                {'error': str(e)}, 
                namespace='/cert-manager'
            )

# Register the certificate manager namespace
socketio.on_namespace(CertManagerNamespace('/cert-manager'))