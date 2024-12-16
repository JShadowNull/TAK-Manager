from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from flask_socketio import Namespace
from backend.services.scripts.ota.ota_updates import OTAUpdate
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
# Helper Functions
# ============================================================================
def get_ota_status_namespace():
    """Helper function to get the OTA status namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, OTAUpdateNamespace))
    except StopIteration:
        raise RuntimeError("OTA status namespace not found")

def execute_ota_operation(operation_func):
    """Execute an OTA operation in a background thread"""
    status_namespace = get_ota_status_namespace()
    
    def operation_thread():
        try:
            status_namespace.start_operation()
            result = operation_func()
            status_namespace.end_operation()
            status_namespace.cleanup_operation_threads()
            return result
        except Exception as e:
            status_namespace.end_operation()
            status_namespace.cleanup_operation_threads()
            raise e
    
    thread = thread_manager.spawn(operation_thread)
    status_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated'}

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

def allowed_file(filename):
    """Check if the file extension is allowed (zip)"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

# ============================================================================
# Socket.IO Namespace
# ============================================================================
class OTAUpdateNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.operation_in_progress = False
        self.operation_threads = []
        self.monitor_thread = None

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
                current_status = {'isUpdating': self.operation_in_progress}
                if current_status != last_status:
                    self.emit_status()
                    last_status = current_status
            except Exception as e:
                socketio.emit('ota_error', {'error': str(e)}, namespace='/ota-update')
            eventlet.sleep(2)

    def emit_status(self):
        """Emit current OTA update status"""
        socketio.emit('ota_status', {
            'isUpdating': self.operation_in_progress
        }, namespace='/ota-update')

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

        def update_operation():
            try:
                if operation_type == 'update':
                    return ota_updater.update()
                else:  # install
                    return ota_updater.main()
            except Exception as e:
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
        status_namespace = get_ota_status_namespace()
        return jsonify({
            'isUpdating': status_namespace.operation_in_progress
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500