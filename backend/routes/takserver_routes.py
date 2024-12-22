# ============================================================================
# Imports
# ============================================================================
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
from backend.services.helpers.docker_installer import DockerInstaller
from flask_socketio import Namespace
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio
import eventlet

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
takserver_bp = Blueprint('takserver', __name__)
thread_manager = ThreadManager()
tak_status_checker = TakServerStatus()
installations = {}

# ============================================================================
# Constants and Shared Functions
# ============================================================================
def create_error_status(error_msg=None):
    """Create a standardized error status dictionary"""
    return {
        'isInstalled': False,
        'isRunning': False,
        'dockerRunning': False,
        'version': None,
        'error': error_msg,
        'isStarting': False,
        'isStopping': False,
        'isRestarting': False,
        'isUninstalling': False
    }

def create_operation_result(success, message):
    """Create a standardized operation result"""
    return {
        'success': success,
        'message': message
    }

def allowed_file(filename):
    """Check if the file extension is allowed (zip)"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

class BaseNamespace(Namespace):
    """Base namespace class with common functionality"""
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.operation_in_progress = False
        self.operation_threads = []

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

    def on_disconnect(self):
        print(f'Client disconnected from {self.namespace}')
        self.cleanup_operation_threads()

def get_namespace(namespace_class):
    """Helper function to get a namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, namespace_class))
    except StopIteration:
        raise RuntimeError(f"{namespace_class.__name__} not found")

def execute_takserver_operation(operation_func):
    """Execute a TAK server operation in a background thread"""
    status_namespace = get_namespace(TakServerStatusNamespace)
    
    def operation_thread():
        try:
            status_namespace.start_operation()
            result = operation_func()
            if result and result.get('error'):
                return create_operation_result(False, result['error'])
            return create_operation_result(True, result.get('status', 'Operation completed successfully'))
        except Exception as e:
            return create_operation_result(False, str(e))
        finally:
            status_namespace.end_operation()
            status_namespace.cleanup_operation_threads()
    
    thread = thread_manager.spawn(operation_thread)
    status_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# Socket.IO Namespaces
# ============================================================================
class TakServerStatusNamespace(BaseNamespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.tak_status = TakServerStatus()
        self.monitor_thread = None

    def on_connect(self):
        print('Client connected to /takserver-status namespace')
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_takserver_status)

    def on_disconnect(self):
        super().on_disconnect()
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def emit_status_update(self, status):
        """Emit status updates to status namespace"""
        socketio.emit('takserver_status', status, namespace='/takserver-status')

    def get_and_emit_status(self):
        """Get current status and emit update"""
        try:
            if not self.operation_in_progress:
                status = self.tak_status.get_status()
                self.emit_status_update(status)
                return status
        except Exception as e:
            error_status = create_error_status(str(e))
            self.emit_status_update(error_status)
            return error_status

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        self.get_and_emit_status()

    def on_check_status(self):
        """Handle manual status check requests"""
        self.get_and_emit_status()

    def monitor_takserver_status(self):
        """Monitor TAK server status continuously"""
        last_status = None
        while True:
            try:
                if not self.operation_in_progress:
                    current_status = self.tak_status.get_status()
                    if current_status != last_status:
                        self.emit_status_update(current_status)
                        last_status = current_status
            except Exception as e:
                if not self.operation_in_progress:
                    self.emit_status_update(create_error_status(str(e)))
            eventlet.sleep(2)

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock and update status"""
        self.operation_in_progress = False
        self.get_and_emit_status()

class TakServerUninstallNamespace(BaseNamespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.uninstaller = TakServerUninstaller()

    def on_connect(self):
        print('Client connected to /takserver-uninstall namespace')

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        initial_state = {
            'isUninstalling': self.operation_in_progress,
            'uninstallComplete': False,
            'uninstallSuccess': False,
            'uninstallError': None,
            'status': None,
            'operationInProgress': self.operation_in_progress
        }
        socketio.emit('initial_state', initial_state, namespace='/takserver-uninstall')

    def emit_status(self):
        """Emit current uninstall status"""
        socketio.emit('uninstall_status', {
            'isUninstalling': self.operation_in_progress
        }, namespace='/takserver-uninstall')

    def on_check_status(self):
        """Handle status check request"""
        self.emit_status()

    def on_start_uninstall(self, data=None):
        """Handle uninstall request"""
        if not self.operation_in_progress:
            self.operation_in_progress = True
            self.emit_status()
            thread = thread_manager.spawn(self.uninstall_task)
            self.operation_threads.append(thread)

    def uninstall_task(self):
        """Background task for uninstallation"""
        try:
            success = self.uninstaller.uninstall()
            socketio.emit('uninstall_complete', create_operation_result(
                success,
                'TAK Server uninstallation completed successfully' if success else 'TAK Server uninstallation failed'
            ), namespace='/takserver-uninstall')
        except Exception as e:
            socketio.emit('uninstall_complete', create_operation_result(
                False,
                f'Uninstallation error: {str(e)}'
            ), namespace='/takserver-uninstall')
        finally:
            self.operation_in_progress = False
            self.emit_status()

class TakServerInstallerNamespace(BaseNamespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_installed = DockerInstaller()
        self.operation_status = OperationStatus(namespace=namespace)

    def on_connect(self):
        print('Client connected to /takserver-installer namespace')

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        try:
            docker_status = self.docker_installed.is_docker_installed()
            initial_state = {
                'isInstalling': self.operation_in_progress,
                'installationComplete': False,
                'installationSuccess': False,
                'installationError': None,
                'isRollingBack': False,
                'isStoppingInstallation': False,
                'status': None,
                'operationInProgress': self.operation_in_progress,
                'dockerInstalled': docker_status.get('isInstalled', False)
            }
            self.operation_status.emit_status(
                operation='installation',
                status='initial',
                message='Ready for installation',
                details=initial_state
            )
        except Exception as e:
            error_state = {
                'isInstalling': False,
                'installationComplete': False,
                'installationSuccess': False,
                'installationError': str(e),
                'isRollingBack': False,
                'isStoppingInstallation': False,
                'status': 'error',
                'operationInProgress': False,
                'dockerInstalled': False
            }
            self.operation_status.emit_status(
                operation='installation',
                status='error',
                message=str(e),
                details=error_state
            )

    def on_check_docker_installed(self):
        """Handle docker installation status check"""
        print('Received request to check if Docker is installed')
        result = self.docker_installed.is_docker_installed()
        self.operation_status.emit_status(
            operation='docker_check',
            status='complete',
            message='Docker installation status checked',
            details=result
        )

# Register the TAK server namespaces
socketio.on_namespace(TakServerStatusNamespace('/takserver-status'))
socketio.on_namespace(TakServerUninstallNamespace('/takserver-uninstall'))
socketio.on_namespace(TakServerInstallerNamespace('/takserver-installer'))

# ============================================================================
# HTTP Routes
# ============================================================================
@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    """Install TAK server"""
    try:
        # Validate file exists in request
        if 'docker_zip_file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['docker_zip_file']
        
        # Validate filename
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload a ZIP file"}), 400

        # Validate required fields
        required_fields = [
            'postgres_password',
            'certificate_password',
            'organization',
            'state',
            'city',
            'organizational_unit',
            'name'
        ]
        
        for field in required_fields:
            if field not in request.form:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Save file
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        os.makedirs(temp_dir, exist_ok=True)
        filename = secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)

        # Initialize installer
        installer = TakServerInstaller(
            docker_zip_path=file_path,
            postgres_password=request.form['postgres_password'],
            certificate_password=request.form['certificate_password'],
            organization=request.form['organization'],
            state=request.form['state'],
            city=request.form['city'],
            organizational_unit=request.form['organizational_unit'],
            name=request.form['name']
        )

        # Generate installation ID and store installer
        installation_id = str(uuid.uuid4())
        installations[installation_id] = installer

        def installation_operation():
            try:
                success = installer.main()
                return create_operation_result(success, 'Installation completed successfully' if success else 'Installation failed')
            except Exception as e:
                return create_operation_result(False, str(e))

        # Execute installation
        operation_result = execute_takserver_operation(installation_operation)
        return jsonify({
            'installation_id': installation_id,
            'message': operation_result.get('message', 'Installation initiated'),
            'status': operation_result.get('status', 'pending')
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def create_server_operation(operation_name, operation_func):
    """Create a standardized server operation"""
    def wrapper():
        try:
            success = operation_func()
            if not success:
                return create_operation_result(False, f'Failed to {operation_name} TAK Server')
            return create_operation_result(True, f'TAK Server {operation_name}ed successfully')
        except Exception as e:
            return create_operation_result(False, str(e))
    return wrapper

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    """Start TAK server"""
    try:
        return jsonify(execute_takserver_operation(
            create_server_operation('start', tak_status_checker.start_containers)
        ))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-stop', methods=['POST'])
def stop_takserver():
    """Stop TAK server"""
    try:
        return jsonify(execute_takserver_operation(
            create_server_operation('stop', tak_status_checker.stop_containers)
        ))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-restart', methods=['POST'])
def restart_takserver():
    """Restart TAK server"""
    try:
        return jsonify(execute_takserver_operation(
            create_server_operation('restart', tak_status_checker.restart_containers)
        ))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/rollback-takserver', methods=['POST'])
def rollback_takserver():
    """Rollback TAK server installation"""
    try:
        data = request.get_json()
        installation_id = data.get('installation_id')

        if not installation_id:
            return jsonify({"error": "Installation ID is required."}), 400

        takserver_installer = installations.get(installation_id)
        if not takserver_installer:
            return jsonify({"error": "No installation found with the provided ID."}), 400

        def rollback_operation():
            try:
                takserver_installer.stop_event.set()
                eventlet.sleep(1)
                takserver_installer.rollback_takserver_installation()
                return create_operation_result(True, 'TAKServer rollback completed successfully')
            except Exception as e:
                return create_operation_result(False, str(e))

        return jsonify(execute_takserver_operation(rollback_operation))

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer rollback: {e}"}), 500