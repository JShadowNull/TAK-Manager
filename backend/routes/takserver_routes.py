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
# Create blueprint for TAKServer routes
takserver_bp = Blueprint('takserver', __name__)

# Initialize managers and checkers
thread_manager = ThreadManager()
tak_status_checker = TakServerStatus()

# Dictionary to keep track of running installations
installations = {}

# ============================================================================
# Helper Functions
# ============================================================================
def get_takserver_status_namespace():
    """Helper function to get the TAK server status namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, TakServerStatusNamespace))
    except StopIteration:
        raise RuntimeError("TAK server status namespace not found")

def get_takserver_uninstall_namespace():
    """Helper function to get the TAK server uninstall namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, TakServerUninstallNamespace))
    except StopIteration:
        raise RuntimeError("TAK server uninstall namespace not found")

def execute_takserver_operation(operation_func):
    """Execute a TAK server operation in a background thread"""
    status_namespace = get_takserver_status_namespace()
    
    def operation_thread():
        try:
            status_namespace.start_operation()
            result = operation_func()
            if result and result.get('error'):
                return {'success': False, 'message': result['error']}
            return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
        except Exception as e:
            return {'success': False, 'message': str(e)}
        finally:
            status_namespace.end_operation()
            status_namespace.cleanup_operation_threads()
    
    # Spawn the operation in a background thread using thread_manager
    thread = thread_manager.spawn(operation_thread)
    status_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

def allowed_file(filename):
    """Check if the file extension is allowed (zip)"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

# ============================================================================
# Socket.IO Namespaces
# ============================================================================
# TAKServer Status Monitoring Socket
class TakServerStatusNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.tak_status = TakServerStatus()
        self.monitor_thread = None
        self.operation_in_progress = False
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

    def on_connect(self):
        print('Client connected to /takserver-status namespace')
        if not self.monitor_thread:
            # Use thread_manager to spawn the monitor thread
            self.monitor_thread = thread_manager.spawn(self.monitor_takserver_status)
        # Send immediate status update when client connects
        self.on_check_status()

    def on_disconnect(self):
        print('Client disconnected from /takserver-status namespace')
        self.cleanup_operation_threads()
        # Kill the monitor thread if it exists
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

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
                        'isInstalled': False,
                        'isRunning': False,
                        'dockerRunning': False,
                        'version': None,
                        'error': str(e),
                        'isStarting': False,
                        'isStopping': False,
                        'isRestarting': False,
                        'isUninstalling': False
                    }
                    self.emit_status_update(error_status)
            
            eventlet.sleep(2)  # Use eventlet.sleep instead of socketio.sleep

    def emit_status_update(self, status):
        """Emit status updates to both relevant namespaces"""
        # Emit to status namespace for status-specific components
        socketio.emit('takserver_status', {
            'isInstalled': status.get('isInstalled', False),
            'isRunning': status.get('isRunning', False),
            'dockerRunning': status.get('dockerRunning', False),
            'version': status.get('version'),
            'error': status.get('error'),
            'isStarting': status.get('isStarting', False),
            'isStopping': status.get('isStopping', False),
            'isRestarting': status.get('isRestarting', False),
            'isUninstalling': status.get('isUninstalling', False)
        }, namespace='/takserver-status')

    def on_check_status(self):
        """Handle manual status check requests"""
        try:
            if not self.operation_in_progress:  # Only check if no operation is in progress
                status = self.tak_status.get_status()
                self.emit_status_update(status)
        except Exception as e:
            error_status = {
                'isInstalled': False,
                'isRunning': False,
                'dockerRunning': False,
                'version': None,
                'error': str(e),
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': False
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

# TAKServer Uninstall Namespace
class TakServerUninstallNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.uninstaller = TakServerUninstaller()
        self.operation_in_progress = False
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

    def on_connect(self):
        print('Client connected to /takserver-uninstall namespace')
        # Send initial status on connect
        self.emit_status()

    def on_disconnect(self):
        print('Client disconnected from /takserver-uninstall namespace')
        self.cleanup_operation_threads()

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
            # Emit status update immediately
            self.emit_status()
            # Use thread_manager to spawn the uninstall task
            thread = thread_manager.spawn(self.uninstall_task)
            self.operation_threads.append(thread)

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

# TAKServer Installer Namespace
class TakServerInstallerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_installed = DockerInstaller()
        self.operation_in_progress = False
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

    def on_connect(self):
        print('Client connected to /takserver-installer namespace')
        # Send initial docker status on connect
        self.on_check_docker_installed()

    def on_disconnect(self):
        print('Client disconnected from /takserver-installer namespace')
        self.cleanup_operation_threads()

    def on_check_docker_installed(self):
        """Handle docker installation status check"""
        print('Received request to check if Docker is installed')
        result = self.docker_installed.is_docker_installed()
        socketio.emit('docker_installed_status', result, namespace='/takserver-installer')

# Register the TAK server namespaces
socketio.on_namespace(TakServerStatusNamespace('/takserver-status'))
socketio.on_namespace(TakServerUninstallNamespace('/takserver-uninstall'))
socketio.on_namespace(TakServerInstallerNamespace('/takserver-installer'))

# ============================================================================
# HTTP Routes
# ============================================================================
@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    try:
        # Get status namespace to manage operation state
        status_namespace = get_takserver_status_namespace()
        
        # Validate file exists in request
        if 'docker_zip_file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['docker_zip_file']
        
        # Validate filename
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload a ZIP file"}), 400

        # Get form data
        required_fields = [
            'postgres_password',
            'certificate_password',
            'organization',
            'state',
            'city',
            'organizational_unit',
            'name'
        ]
        
        # Validate all required fields are present
        for field in required_fields:
            if field not in request.form:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Create temp directory if it doesn't exist
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Save file with secure filename
        filename = secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)

        # Initialize installer with all parameters
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

        # Generate installation ID
        installation_id = str(uuid.uuid4())
        installations[installation_id] = installer

        def installation_operation():
            try:
                success = installer.main()
                if not success:
                    return {'error': 'Installation failed'}
                return {'status': 'Installation completed successfully'}
            except Exception as e:
                return {'error': str(e)}

        # Execute the operation and return response with installation ID
        operation_result = execute_takserver_operation(installation_operation)
        return jsonify({
            'installation_id': installation_id,
            'message': operation_result.get('message', 'Installation initiated'),
            'status': operation_result.get('status', 'pending')
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    """Start TAK server"""
    try:
        def start_operation():
            try:
                success = tak_status_checker.start_containers()
                if not success:
                    return {'error': 'Failed to start TAK Server'}
                return {'status': 'TAK Server started successfully'}
            except Exception as e:
                return {'error': str(e)}
            
        return jsonify(execute_takserver_operation(start_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-stop', methods=['POST'])
def stop_takserver():
    """Stop TAK server"""
    try:
        def stop_operation():
            try:
                success = tak_status_checker.stop_containers()
                if not success:
                    return {'error': 'Failed to stop TAK Server'}
                return {'status': 'TAK Server stopped successfully'}
            except Exception as e:
                return {'error': str(e)}
            
        return jsonify(execute_takserver_operation(stop_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-restart', methods=['POST'])
def restart_takserver():
    """Restart TAK server"""
    try:
        def restart_operation():
            try:
                success = tak_status_checker.restart_containers()
                if not success:
                    return {'error': 'Failed to restart TAK Server'}
                return {'status': 'TAK Server restarted successfully'}
            except Exception as e:
                return {'error': str(e)}
            
        return jsonify(execute_takserver_operation(restart_operation))
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
                # Set the stop event to trigger rollback
                takserver_installer.stop_event.set()
                # Wait a moment for the stop event to be processed
                eventlet.sleep(1)
                # Perform rollback
                takserver_installer.rollback_takserver_installation()
                return {'status': 'TAKServer rollback completed successfully'}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_takserver_operation(rollback_operation))

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer rollback: {e}"}), 500