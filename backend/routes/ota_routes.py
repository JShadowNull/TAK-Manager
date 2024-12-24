from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from flask_socketio import Namespace
from backend.services.scripts.ota.ota_updates import OTAUpdate
from backend.services.helpers.operation_status import OperationStatus
import os
import uuid
import eventlet
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
ota_bp = Blueprint('ota', __name__)
thread_manager = ThreadManager()
updates = {}

# ============================================================================
# Constants and Shared Functions
# ============================================================================
def create_error_status(error_msg=None):
    """Create a standardized error status dictionary"""
    return {
        'isUpdating': False,
        'updateComplete': False,
        'updateSuccess': False,
        'updateError': error_msg
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

def get_namespace(namespace_class):
    """Helper function to get a namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, namespace_class))
    except StopIteration:
        raise RuntimeError(f"{namespace_class.__name__} not found")

def execute_ota_operation(operation_func):
    """Execute an OTA operation in a background thread"""
    status_namespace = get_namespace(OTAUpdateNamespace)
    
    def operation_thread():
        try:
            status_namespace.start_operation()
            result = operation_func()
            if isinstance(result, dict) and result.get('error'):
                return create_operation_result(False, result['error'])
            return create_operation_result(True, 'Operation completed successfully')
        except Exception as e:
            return create_operation_result(False, str(e))
        finally:
            status_namespace.end_operation()
            status_namespace.cleanup_operation_threads()
    
    thread = thread_manager.spawn(operation_thread)
    status_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

def process_ota_file(request):
    """Process and validate OTA file from request"""
    if 'ota_zip_file' not in request.files:
        raise ValueError("No file provided")
        
    file = request.files['ota_zip_file']
    
    if file.filename == '':
        raise ValueError("No file selected")
        
    if not allowed_file(file.filename):
        raise ValueError("Invalid file type. Please upload a ZIP file")

    temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
    os.makedirs(temp_dir, exist_ok=True)

    filename = secure_filename(file.filename)
    file_path = os.path.join(temp_dir, filename)
    file.save(file_path)
    
    return file_path

# ============================================================================
# Socket.IO Namespace
# ============================================================================
class OTAUpdateNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.operation_in_progress = False
        self.operation_threads = []
        self.monitor_thread = None
        self.operation_status = OperationStatus(namespace='/ota-update')

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

    def on_connect(self):
        print('Client connected to /ota-update namespace')
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_ota_status)
        self.emit_status()

    def on_disconnect(self):
        print('Client disconnected from /ota-update namespace')
        self.cleanup_operation_threads()
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def monitor_ota_status(self):
        """Monitor OTA update status"""
        last_status = None
        while True:
            try:
                current_status = {
                    'isUpdating': self.operation_in_progress,
                    'updateComplete': not self.operation_in_progress,
                    'updateSuccess': not self.operation_in_progress,
                    'updateError': None
                }
                if current_status != last_status:
                    self.emit_status()
                    last_status = current_status
            except Exception as e:
                error_status = create_error_status(str(e))
                self.operation_status.emit_status(
                    operation='ota_update',
                    status='error',
                    message=str(e),
                    details=error_status
                )
            eventlet.sleep(2)

    def emit_status(self):
        """Emit current OTA update status"""
        status = {
            'isUpdating': self.operation_in_progress,
            'updateComplete': not self.operation_in_progress,
            'updateSuccess': not self.operation_in_progress,
            'updateError': None
        }
        self.operation_status.emit_status(
            operation='ota_update',
            status='in_progress' if self.operation_in_progress else 'complete',
            message='OTA update in progress' if self.operation_in_progress else 'OTA update complete',
            details=status
        )

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        initial_state = {
            'isUpdating': self.operation_in_progress,
            'updateComplete': False,
            'updateSuccess': False,
            'updateError': None
        }
        self.operation_status.emit_status(
            operation='ota_update',
            status='initial',
            message='Ready for update',
            details=initial_state
        )

    def on_check_status(self):
        """Handle status check request"""
        self.emit_status()

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True
        self.emit_status()

    def end_operation(self):
        """Release the operation lock and update status"""
        self.operation_in_progress = False
        self.emit_status()

# Register the OTA update namespace
socketio.on_namespace(OTAUpdateNamespace('/ota-update'))

# ============================================================================
# HTTP Routes
# ============================================================================
@ota_bp.route('/ota-update', methods=['POST'])
def handle_ota_update():
    """Handle both update and installation operations"""
    try:
        operation_type = request.form.get('operation_type', 'update')
        if operation_type not in ['update', 'install']:
            return jsonify({"error": "Invalid operation type"}), 400

        try:
            file_path = process_ota_file(request)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        update_id = str(uuid.uuid4())
        ota_updater = OTAUpdate(file_path)
        updates[update_id] = ota_updater

        # Get OTA namespace to manage status updates
        ota_namespace = get_namespace(OTAUpdateNamespace)

        def update_operation():
            try:
                # Start the operation with initial status
                initial_details = {
                    'isUpdating': True,
                    'updateComplete': False,
                    'updateSuccess': False,
                    'updateError': None
                }
                ota_namespace.operation_status.start_operation(
                    'ota_update',
                    f"Starting OTA {operation_type}",
                    initial_details
                )

                # Execute the operation
                if operation_type == 'update':
                    success = ota_updater.update()
                else:  # install
                    success = ota_updater.main()

                # Update final status
                if success:
                    success_details = {
                        'isUpdating': False,
                        'updateComplete': True,
                        'updateSuccess': True,
                        'updateError': None
                    }
                    ota_namespace.operation_status.complete_operation(
                        'ota_update',
                        f"OTA {operation_type} completed successfully",
                        success_details
                    )
                else:
                    error_details = {
                        'isUpdating': False,
                        'updateComplete': True,
                        'updateSuccess': False,
                        'updateError': "Operation failed"
                    }
                    ota_namespace.operation_status.fail_operation(
                        'ota_update',
                        f"OTA {operation_type} failed",
                        error_details
                    )
                return success
            except Exception as e:
                error_details = {
                    'isUpdating': False,
                    'updateComplete': True,
                    'updateSuccess': False,
                    'updateError': str(e)
                }
                ota_namespace.operation_status.fail_operation(
                    'ota_update',
                    str(e),
                    error_details
                )
                raise e

        # Execute the operation
        execute_ota_operation(update_operation)
        return jsonify({
            'update_id': update_id,
            'message': f'OTA {operation_type} initiated'
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ota_bp.route('/ota-status', methods=['GET'])
def get_ota_status():
    """Get current OTA update status"""
    try:
        status_namespace = get_namespace(OTAUpdateNamespace)
        status = {
            'isUpdating': status_namespace.operation_in_progress,
            'updateComplete': not status_namespace.operation_in_progress,
            'updateSuccess': not status_namespace.operation_in_progress,
            'updateError': None
        }
        return jsonify(status)
    except Exception as e:
        return jsonify(create_error_status(str(e))), 500