# ============================================================================
# Imports
# ============================================================================
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_uninstaller import TakServerUninstaller
from backend.services.helpers.operation_status import OperationStatus
from flask_socketio import Namespace
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio
import eventlet
import logging

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
takserver_bp = Blueprint('takserver', __name__)
thread_manager = ThreadManager()
tak_status_checker = TakServerStatus()
installations = {}
uninstallations = {}  # Track uninstallation processes

# ============================================================================
# Helper Functions
# ============================================================================
def create_operation_result(success, message, results=None):
    """Create a standardized operation result"""
    result = {
        'success': success,
        'message': message
    }
    if results is not None:
        result['results'] = results
    return result

def get_namespace(namespace_class):
    """Get a specific namespace instance"""
    for namespace in socketio.server.namespace_handlers.values():
        if isinstance(namespace, namespace_class):
            return namespace
    return None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

def validate_installation_request(request):
    if 'docker_zip_file' not in request.files:
        return False, "No file provided"
    
    file = request.files['docker_zip_file']
    if file.filename == '':
        return False, "No file selected"
    
    if not allowed_file(file.filename):
        return False, "Invalid file type. Please upload a ZIP file"

    required_fields = [
        'postgres_password', 'certificate_password', 'organization',
        'state', 'city', 'organizational_unit', 'name'
    ]
    
    for field in required_fields:
        if field not in request.form:
            return False, f"Missing required field: {field}"
    
    return True, None

def execute_takserver_operation(operation_func, namespace_instance, operation_type):
    """Execute a TAK Server operation in a background thread"""
    def operation_thread():
        try:
            namespace_instance.start_operation()
            # Get current status for details
            status = namespace_instance.tak_status.get_status()
            status.update({
                'isStarting': operation_type == 'start',
                'isStopping': operation_type == 'stop',
                'isRestarting': operation_type == 'restart',
                'error': None
            })
            
            namespace_instance.operation_status.emit_status(
                operation=operation_type,
                status='in_progress',
                message=f'{operation_type.capitalize()} operation in progress...',
                details=status
            )
            
            result = operation_func()
            
            if result:
                namespace_instance.emit_operation_complete(True, None, operation_type)
            else:
                namespace_instance.emit_operation_complete(False, "Operation failed", operation_type)
            return result
        except Exception as e:
            error_msg = str(e)
            namespace_instance.emit_operation_complete(False, error_msg, operation_type)
            current_app.logger.error(f"Operation error: {error_msg}")
            return False
        finally:
            namespace_instance.end_operation()

    thread = thread_manager.spawn(operation_thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# Socket.IO Base Class
# ============================================================================
class BaseNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.operation_in_progress = False
        self.operation_status = OperationStatus(namespace=namespace)

    def on_connect(self):
        print(f'Client connected to {self.namespace}')

    def on_disconnect(self):
        print(f'Client disconnected from {self.namespace}')

    def start_operation(self):
        """Set operation_in_progress flag to True"""
        self.operation_in_progress = True

    def end_operation(self):
        """Set operation_in_progress flag to False"""
        self.operation_in_progress = False

# ============================================================================
# Socket.IO Namespaces
# ============================================================================
class TakServerStatusNamespace(BaseNamespace):
    def __init__(self):
        super().__init__('/takserver-status')
        self.tak_status = TakServerStatus()
        self.monitor_thread = None

    def on_connect(self):
        super().on_connect()
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_takserver_status)

    def on_disconnect(self):
        super().on_disconnect()
        if self.monitor_thread and not self.monitor_thread.dead:
            self.monitor_thread.kill()
        self.monitor_thread = None

    def on_request_initial_state(self, *args):
        """Send initial state to client"""
        status = self.tak_status.get_status()
        if not status['isInstalled']:
            self.operation_status.emit_status(
                operation='status',
                status='not_installed',
                message="TAK Server is not installed"
            )
            return

        self.operation_status.emit_status(
            operation='status',
            status='running' if status['isRunning'] else 'stopped',
            message="TAK Server is running" if status['isRunning'] else "TAK Server is stopped"
        )

    def monitor_takserver_status(self):
        """Monitor TAK server status and emit only when there are changes"""
        last_status = None
        while True:
            try:
                status = self.tak_status.get_status()
                
                # First check if installed
                if not status['isInstalled']:
                    if last_status is None or last_status.get('isInstalled', True):
                        self.operation_status.emit_status(
                            operation='status',
                            status='not_installed',
                            message="TAK Server is not installed"
                        )
                    last_status = status
                    eventlet.sleep(2)
                    continue

                # If installed, monitor running state
                is_running = status['isRunning']
                if last_status is None or last_status.get('isRunning') != is_running:
                    self.operation_status.emit_status(
                        operation='status',
                        status='running' if is_running else 'stopped',
                        message="TAK Server is running" if is_running else "TAK Server is stopped"
                    )
                last_status = status

            except Exception as e:
                print(f"Error in monitor_takserver_status: {str(e)}")
            finally:
                eventlet.sleep(2)

    def emit_operation_complete(self, error_message=None, operation_type='status'):
        """Emit operation complete status"""
        status = self.tak_status.get_status()
        is_running = status.get('isRunning', False)
        
        self.operation_status.emit_status(
            operation=operation_type,
            status='running' if is_running else 'stopped',
            message=error_message if error_message else f'{operation_type.capitalize()} completed successfully'
        )
class TakServerInstallerNamespace(BaseNamespace):
    def __init__(self):
        super().__init__('/takserver-installer')

    def on_connect(self):
        super().on_connect()

    def on_disconnect(self):
        super().on_disconnect()

class TakServerUninstallNamespace(BaseNamespace):
    def __init__(self):
        super().__init__('/takserver-uninstall')

    def on_connect(self):
        super().on_connect()

    def on_disconnect(self):
        super().on_disconnect()

# Register all Socket.IO namespaces
socketio.on_namespace(TakServerStatusNamespace())
socketio.on_namespace(TakServerInstallerNamespace())
socketio.on_namespace(TakServerUninstallNamespace())

# ============================================================================
# HTTP Routes
# ============================================================================
@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    try:
        # Check if installation is already in progress
        if any(installer for installer in installations.values() if installer.get_progress()['status'] == 'in_progress'):
            return jsonify({
                'success': False,
                'error': "Installation already in progress", 
                'status': 'error'
            }), 409

        # Check if TAK server is already installed
        status = tak_status_checker.get_status()
        if status.get('isInstalled', False):
            return jsonify({
                'success': False,
                'error': "TAK Server is already installed",
                'status': 'error'
            }), 409

        # Validate request
        is_valid, error_message = validate_installation_request(request)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_message,
                'status': 'error'
            }), 400

        # Save uploaded file and create installer
        file = request.files['docker_zip_file']
        upload_dir = get_upload_path()
        filename = secure_filename(file.filename)
        file_path = os.path.join(upload_dir, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
        file.save(file_path)

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

        installation_id = str(uuid.uuid4())
        installations[installation_id] = installer

        def installation_task():
            try:
                success = installer.main()
                if success:
                    installer.update_progress(100, 'complete')
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    # Keep installer in memory for 5 seconds to allow frontend to get final status
                    eventlet.sleep(5)
                return success
            except Exception as e:
                installer.update_progress(0, 'error', str(e))
                return False
            finally:
                # Ensure progress is sent before removing installer
                eventlet.sleep(1)
                if installation_id in installations:
                    del installations[installation_id]

        thread = thread_manager.spawn(installation_task)
        return jsonify({
            'success': True,
            'installation_id': installation_id,
            'message': 'Installation started successfully',
            'status': 'pending',
            'progress': 0
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error'
        }), 500

@takserver_bp.route('/installation-progress/<installation_id>', methods=['GET'])
def get_installation_progress(installation_id):
    installer = installations.get(installation_id)
    if not installer:
        return jsonify({
            'success': False,
            'error': 'Installation not found',
            'status': 'not_found',
            'progress': 0
        }), 404

    try:
        progress_info = installer.get_progress()
        status = progress_info['status']
        progress = progress_info['progress']

        response = {
            'success': True,
            'status': status,
            'progress': progress,
            'message': 'Installation in progress' if status == 'in_progress' else 'Installation complete'
        }

        if status == 'complete':
            response['message'] = 'Installation completed successfully'
        elif status == 'error':
            response.update({
                'success': False,
                'error': progress_info.get('error', 'Unknown error occurred')
            })

        return jsonify(response)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error',
            'progress': 0
        }), 500

@takserver_bp.route('/takserver-operation-progress', methods=['GET'])
def get_operation_progress():
    """Get progress of current TAK server operation (start/stop/restart)"""
    try:
        progress_info = tak_status_checker.get_operation_progress()
        response = {
            'success': True,
            'operation': progress_info['operation'],
            'progress': progress_info['progress'],
            'status': progress_info['status']
        }
        logger.debug(f"[TakServer] Operation progress response: {response}")
        return jsonify(response)
    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error',
            'progress': 0
        }
        logger.error(f"[TakServer] Operation progress error response: {error_response}")
        return jsonify(error_response), 500

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    try:
        logger.debug("[TakServer] Received start request")
        if tak_status_checker.current_operation:
            error_response = {
                'success': False,
                'error': "Another operation is in progress",
                'status': 'error'
            }
            logger.warning(f"[TakServer] Start request rejected - Response: {error_response}")
            return jsonify(error_response), 409

        def start_task():
            logger.debug("[TakServer] Starting containers")
            result = tak_status_checker.start_containers()
            logger.debug(f"[TakServer] Start operation completed with result: {result}")
            return result

        thread = thread_manager.spawn(start_task)
        success_response = {
            'success': True,
            'message': 'Start operation initiated',
            'status': 'in_progress'
        }
        logger.debug(f"[TakServer] Start operation initiated - Response: {success_response}")
        return jsonify(success_response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error'
        }
        logger.error(f"[TakServer] Start operation error - Response: {error_response}")
        return jsonify(error_response), 500

@takserver_bp.route('/takserver-stop', methods=['POST'])
def stop_takserver():
    try:
        logger.debug("[TakServer] Received stop request")
        if tak_status_checker.current_operation:
            error_response = {
                'success': False,
                'error': "Another operation is in progress",
                'status': 'error'
            }
            logger.warning(f"[TakServer] Stop request rejected - Response: {error_response}")
            return jsonify(error_response), 409

        def stop_task():
            logger.debug("[TakServer] Stopping containers")
            result = tak_status_checker.stop_containers()
            logger.debug(f"[TakServer] Stop operation completed with result: {result}")
            return result

        thread = thread_manager.spawn(stop_task)
        success_response = {
            'success': True,
            'message': 'Stop operation initiated',
            'status': 'in_progress'
        }
        logger.debug(f"[TakServer] Stop operation initiated - Response: {success_response}")
        return jsonify(success_response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error'
        }
        logger.error(f"[TakServer] Stop operation error - Response: {error_response}")
        return jsonify(error_response), 500

@takserver_bp.route('/takserver-restart', methods=['POST'])
def restart_takserver():
    try:
        logger.debug("[TakServer] Received restart request")
        if tak_status_checker.current_operation:
            error_response = {
                'success': False,
                'error': "Another operation is in progress",
                'status': 'error'
            }
            logger.warning(f"[TakServer] Restart request rejected - Response: {error_response}")
            return jsonify(error_response), 409

        def restart_task():
            logger.debug("[TakServer] Restarting containers")
            result = tak_status_checker.restart_containers()
            logger.debug(f"[TakServer] Restart operation completed with result: {result}")
            return result

        thread = thread_manager.spawn(restart_task)
        success_response = {
            'success': True,
            'message': 'Restart operation initiated',
            'status': 'in_progress'
        }
        logger.debug(f"[TakServer] Restart operation initiated - Response: {success_response}")
        return jsonify(success_response)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e),
            'status': 'error'
        }
        logger.error(f"[TakServer] Restart operation error - Response: {error_response}")
        return jsonify(error_response), 500

@takserver_bp.route('/rollback-takserver', methods=['POST'])
def rollback_takserver():
    try:
        data = request.get_json()
        installation_id = data.get('installation_id')
        
        if not installation_id:
            return jsonify({
                'success': False,
                'error': "Installation ID is required",
                'status': 'error'
            }), 400
        
        installer = installations.get(installation_id)
        if not installer:
            return jsonify({
                'success': False,
                'error': "No installation found with the provided ID",
                'status': 'error'
            }), 404

        def rollback_task():
            try:
                return installer.rollback_takserver_installation()
            except Exception as e:
                current_app.logger.error(f"Rollback error: {str(e)}")
                return False
            finally:
                if installation_id in installations:
                    del installations[installation_id]

        thread = thread_manager.spawn(rollback_task)
        return jsonify({
            'success': True,
            'message': "Rollback operation initiated",
            'status': 'pending',
            'progress': 0
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error',
            'progress': 0
        }), 500

@takserver_bp.route('/uninstall-takserver', methods=['POST'])
def uninstall_takserver():
    """Uninstall TAK server and remove all associated files and containers."""
    try:
        # Create uninstaller instance and generate ID
        uninstall_id = str(uuid.uuid4())
        uninstaller = TakServerUninstaller()
        uninstallations[uninstall_id] = uninstaller
        
        def uninstall_task():
            try:
                success = uninstaller.uninstall()
                if success:
                    uninstaller.update_status(
                        progress=100,
                        message="TAK Server uninstallation completed successfully",
                        status='complete'
                    )
                    # Keep uninstaller in memory for 5 seconds to allow frontend to get final status
                    eventlet.sleep(5)
                return success
            except Exception as e:
                current_app.logger.error(f"Uninstallation error: {str(e)}")
                uninstaller.update_status(
                    status='error',
                    error=str(e)
                )
                return False
            finally:
                # Ensure status is sent before cleanup
                eventlet.sleep(1)
                if uninstall_id in uninstallations:
                    del uninstallations[uninstall_id]

        thread = thread_manager.spawn(uninstall_task)
        
        return jsonify({
            'success': True,
            'uninstall_id': uninstall_id,
            'status': 'in_progress'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error during TAK Server uninstallation: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error'
        }), 500

@takserver_bp.route('/uninstall-progress/<uninstall_id>', methods=['GET'])
def get_uninstall_progress(uninstall_id):
    """Get progress of TAK server uninstallation."""
    try:
        uninstaller = uninstallations.get(uninstall_id)
        if not uninstaller:
            return jsonify({
                'success': False,
                'error': 'Uninstallation not found',
                'status': 'not_found',
                'progress': 0
            }), 404

        progress_info = uninstaller.get_status()
        status = progress_info.get('status', 'idle')
        progress = progress_info.get('progress', 0)

        response = {
            'success': True,
            'status': status,
            'progress': progress,
            'message': progress_info.get('message', ''),
        }

        if status == 'complete':
            response['message'] = 'Uninstallation completed successfully'
        elif status == 'error':
            response.update({
                'success': False,
                'error': progress_info.get('error', 'Unknown error occurred')
            })

        return jsonify(response)

    except Exception as e:
        current_app.logger.error(f"Error getting uninstall progress: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error',
            'progress': 0
        }), 500