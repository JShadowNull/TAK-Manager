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
    manage_session=False  # Disable session management to avoid thread issues
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

# Docker Manager/Monitor Socket
class DockerManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_manager = DockerManager()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /docker-manager namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_docker_status)
            thread_manager.add_thread(self.monitor_thread)

    def on_disconnect(self):
        print('Client disconnected from /docker-manager namespace')

    def monitor_docker_status(self):
        last_status = None
        last_containers = None

        while True:
            current_status = self.docker_manager.check_docker_status()
            if current_status != last_status:
                socketio.emit('docker_status', {'docker_running': current_status}, namespace='/docker-manager')
                last_status = current_status

            if current_status:
                current_containers = self.docker_manager.list_containers()
                if current_containers != last_containers:
                    socketio.emit('containers', {'containers': current_containers}, namespace='/docker-manager')
                    last_containers = current_containers

            socketio.sleep(2)

    def on_check_docker_status(self):
        status = self.docker_manager.check_docker_status()
        socketio.emit('docker_status', {'docker_running': status}, namespace='/docker-manager')
        if status:
            containers = self.docker_manager.list_containers()
            socketio.emit('containers', {'containers': containers}, namespace='/docker-manager')

    def on_start_docker(self):
        thread = socketio.start_background_task(self.start_docker_task)
        thread_manager.add_thread(thread)

    def on_stop_docker(self):
        thread = socketio.start_background_task(self.stop_docker_task)
        thread_manager.add_thread(thread)

    def start_docker_task(self):
        self.docker_manager.start_docker()
        socketio.sleep(10)
        self.on_check_docker_status()

    def stop_docker_task(self):
        self.docker_manager.stop_docker()
        socketio.sleep(5)
        self.on_check_docker_status()

    def on_start_container(self, data):
        container_name = data.get('container_name')
        thread = socketio.start_background_task(self.start_container_task, container_name)
        thread_manager.add_thread(thread)

    def on_stop_container(self, data):
        container_name = data.get('container_name')
        thread = socketio.start_background_task(self.stop_container_task, container_name)
        thread_manager.add_thread(thread)

    def start_container_task(self, container_name):
        self.docker_manager.start_container(container_name)
        socketio.sleep(2)
        self.on_check_docker_status()

    def stop_container_task(self, container_name):
        self.docker_manager.stop_container(container_name)
        socketio.sleep(2)
        self.on_check_docker_status()

socketio.on_namespace(DockerManagerNamespace('/docker-manager'))

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

from backend.services.scripts.takserver.check_status import TakServerStatus
# TAKServer Status Monitoring Socket
class TakServerStatusNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.tak_status = TakServerStatus()
        self.monitor_thread = None
        self.operation_in_progress = False  # Add lock flag

    def on_connect(self):
        print('Client connected to /takserver-status namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_takserver_status)
            thread_manager.add_thread(self.monitor_thread)
        # Send immediate status update when client connects
        self.on_check_status()

    def on_disconnect(self):
        print('Client disconnected from /takserver-status namespace')

    def monitor_takserver_status(self):
        last_status = None
        while True:
            try:
                # Skip status check if operation is in progress
                if not self.operation_in_progress:
                    current_status = self.tak_status.get_status()
                    if current_status != last_status:
                        self.emit_status_update(current_status)
                        last_status = current_status
            except Exception as e:
                if not self.operation_in_progress:  # Only emit error if no operation is in progress
                    error_status = {
                        'error': str(e),
                        'installed': False,
                        'running': False,
                        'docker_running': False,
                        'version': None
                    }
                    self.emit_status_update(error_status)
            
            socketio.sleep(2)

    def emit_status_update(self, status):
        """Emit status updates to both relevant namespaces"""
        # Emit to status namespace for status-specific components
        socketio.emit('takserver_status', {
            'isInstalled': status['installed'],
            'isRunning': status['running'],
            'dockerRunning': status['docker_running'],
            'version': status.get('version'),
            'error': status.get('error'),
            'isStarting': status.get('is_starting', False),
            'isStopping': status.get('is_stopping', False),
            'isRestarting': status.get('is_restarting', False)
        }, namespace='/takserver-status')

    def on_check_status(self):
        """Handle manual status check requests"""
        try:
            if not self.operation_in_progress:  # Only check if no operation is in progress
                status = self.tak_status.get_status()
                self.emit_status_update(status)
        except Exception as e:
            error_status = {
                'error': str(e),
                'installed': False,
                'running': False,
                'docker_running': False,
                'version': None
            }
            self.emit_status_update(error_status)

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock and update status"""
        self.operation_in_progress = False
        # Force a status update after operation completes
        try:
            current_status = self.tak_status.get_status()
            self.emit_status_update(current_status)
        except Exception as e:
            print(f"Error updating status after operation: {e}")

# Register the TAK server status namespace
socketio.on_namespace(TakServerStatusNamespace('/takserver-status'))

# Docker Status Namespace
from backend.services.scripts.docker.docker_checker import DockerChecker

class DockerStatusNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_checker = DockerChecker()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /docker-status namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_docker_status)
            thread_manager.add_thread(self.monitor_thread)
        # Send immediate status update when client connects
        self.emit_status_update()

    def on_disconnect(self):
        print('Client disconnected from /docker-status namespace')

    def monitor_docker_status(self):
        last_status = None
        while True:
            try:
                current_status = self.docker_checker.get_status()
                if current_status != last_status:
                    self.emit_status_update(current_status)
                    last_status = current_status
            except Exception as e:
                error_status = {
                    'isInstalled': False,
                    'isRunning': False,
                    'error': f"Error checking Docker status: {str(e)}"
                }
                self.emit_status_update(error_status)
            socketio.sleep(2)

    def emit_status_update(self, status=None):
        """Emit Docker status updates"""
        if status is None:
            status = self.docker_checker.get_status()
        socketio.emit('docker_status', status, namespace='/docker-status')

    def on_check_status(self):
        """Handle manual status check requests"""
        try:
            status = self.docker_checker.get_status()
            self.emit_status_update(status)
        except Exception as e:
            error_status = {
                'isInstalled': False,
                'isRunning': False,
                'error': f"Error checking Docker status: {str(e)}"
            }
            self.emit_status_update(error_status)

# Register the Docker status namespace
socketio.on_namespace(DockerStatusNamespace('/docker-status'))

from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller

# TAKServer Uninstall Namespace
class TakServerUninstallNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.uninstaller = TakServerUninstaller()
        self.operation_in_progress = False

    def on_connect(self):
        print('Client connected to /takserver-uninstall namespace')
        # Send initial status on connect
        self.emit_status()

    def on_disconnect(self):
        print('Client disconnected from /takserver-uninstall namespace')

    def emit_status(self):
        """Emit current uninstall status"""
        socketio.emit('uninstall_status', {
            'isUninstalling': self.operation_in_progress
        }, namespace='/takserver-uninstall')

    def on_check_status(self):
        """Handle status check request"""
        self.emit_status()

    def on_start_uninstall(self):
        """Handle uninstall request"""
        if not self.operation_in_progress:
            self.operation_in_progress = True
            # Emit status update immediately
            self.emit_status()
            thread = socketio.start_background_task(self.uninstall_task)
            thread_manager.add_thread(thread)

    def uninstall_task(self):
        """Background task for uninstallation"""
        try:
            success = self.uninstaller.uninstall()
            if success:
                socketio.emit('uninstall_complete', {
                    'success': True,
                    'message': 'TAK Server uninstallation completed successfully'
                }, namespace='/takserver-uninstall')
            else:
                socketio.emit('uninstall_complete', {
                    'success': False,
                    'message': 'TAK Server uninstallation failed'
                }, namespace='/takserver-uninstall')
        except Exception as e:
            socketio.emit('uninstall_complete', {
                'success': False,
                'message': f'Uninstallation error: {str(e)}'
            }, namespace='/takserver-uninstall')
        finally:
            self.operation_in_progress = False
            # Emit final status update
            self.emit_status()

# Register the uninstall namespace
socketio.on_namespace(TakServerUninstallNamespace('/takserver-uninstall'))

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