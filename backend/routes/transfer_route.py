# Path: backend/routes/transfer_route.py

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from backend.services.scripts.transfer.transfer import RapidFileTransfer
from flask_socketio import Namespace
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio, safe_emit
import os
import eventlet
import time

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
# Create blueprint for Transfer routes
transfer_bp = Blueprint('transfer', __name__, url_prefix='/api/transfer')

# Initialize managers
thread_manager = ThreadManager()
rapid_file_transfer = RapidFileTransfer()

# ============================================================================
# Helper Functions
# ============================================================================
def get_transfer_namespace():
    """Helper function to get the Transfer namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, TransferNamespace))
    except StopIteration:
        raise RuntimeError("Transfer namespace not found")

def execute_transfer_operation(operation_func):
    """Execute a transfer operation in a background thread"""
    transfer_namespace = get_transfer_namespace()
    
    def operation_thread():
        try:
            transfer_namespace.start_operation()
            result = operation_func()
            if result and result.get('error'):
                rapid_file_transfer.emit_transfer_update(
                    status_type="error",
                    error=result['error']
                )
                return {'success': False, 'message': result['error']}
            return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
        except Exception as e:
            rapid_file_transfer.emit_transfer_update(
                status_type="error",
                error=str(e)
            )
            return {'success': False, 'message': str(e)}
        finally:
            transfer_namespace.end_operation()
            transfer_namespace.cleanup_operation_threads()
    
    # Spawn the operation in a background thread using thread_manager
    thread = thread_manager.spawn(operation_thread)
    transfer_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# Socket.IO Namespace
# ============================================================================
class TransferNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.rapid_file_transfer = RapidFileTransfer()
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
        print('Client connected to /transfer namespace')
        if not self.monitor_thread:
            self.start_monitoring()
        # Get current state
        self.on_get_connected_devices()
        self.on_get_transfer_status()

    def on_disconnect(self):
        print('Client disconnected from /transfer namespace')
        self.cleanup_operation_threads()
        # Kill the monitor thread if it exists
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def start_monitoring(self):
        """Start the device monitoring thread"""
        if not self.rapid_file_transfer.monitoring:
            # Signal RapidFileTransfer that monitoring is starting
            self.rapid_file_transfer.start_monitoring()
            # Create and manage the monitoring thread
            self.monitor_thread = thread_manager.spawn(
                self.rapid_file_transfer.monitor_devices
            )

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock and update status"""
        self.operation_in_progress = False
        # Force a status update after operation completes
        self.on_get_transfer_status()

    def on_get_connected_devices(self):
        """Handle request for current device list"""
        if not self.operation_in_progress:
            self.rapid_file_transfer.emit_connected_devices()

    def on_start_transfer(self):
        """Start transfer for all connected devices"""
        if not self.operation_in_progress:
            self.operation_in_progress = True
            try:
                # Get list of devices that need transfer
                device_ids = self.rapid_file_transfer.start_transfer_all_devices()
                
                if device_ids:
                    # Create transfer threads for each device
                    for device_id in device_ids:
                        transfer_thread = thread_manager.spawn(
                            self.rapid_file_transfer.start_transfer,
                            device_id
                        )
                        self.operation_threads.append(transfer_thread)
            finally:
                self.operation_in_progress = False

    def on_stop_transfer(self):
        """Stop all ongoing transfers"""
        if not self.operation_in_progress:
            self.operation_in_progress = True
            try:
                self.rapid_file_transfer.stop_transfer()
            finally:
                self.operation_in_progress = False

    def on_get_transfer_status(self):
        """Handle transfer status request"""
        if not self.operation_in_progress:
            self.rapid_file_transfer.get_transfer_status()

# Register the transfer namespace
socketio.on_namespace(TransferNamespace('/transfer'))

# ============================================================================
# HTTP Routes
# ============================================================================
@transfer_bp.route('/check_adb', methods=['GET'])
def check_adb():
    """Route to check if ADB is installed"""
    try:
        def check_operation():
            try:
                is_installed = rapid_file_transfer.check_adb_installed()
                if is_installed:
                    return {'status': 'ADB is already installed'}
                return {'error': 'ADB is not installed'}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_transfer_operation(check_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/install_adb', methods=['POST'])
def install_adb():
    """Route to install ADB if not installed"""    
    try:
        def install_operation():
            try:
                success = rapid_file_transfer.install_adb()
                if not success:
                    return {'error': 'Failed to install ADB'}
                return {'status': 'ADB installed successfully'}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_transfer_operation(install_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload to temporary directory"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
            
            # Ensure temp directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            def upload_operation():
                try:
                    file.save(file_path)
                    rapid_file_transfer.emit_file_update('change', {
                        'filename': filename,
                        'action': 'uploaded'
                    })
                    return {'status': f'File {filename} uploaded successfully'}
                except Exception as e:
                    return {'error': str(e)}

            return jsonify(execute_transfer_operation(upload_operation))
        
        return jsonify({"error": "Invalid file"}), 400
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/delete_file', methods=['POST'])
def delete_file():
    """Handle file deletion from temporary directory"""
    try:
        data = request.get_json()
        if not data or 'filename' not in data:
            return jsonify({"error": "No filename provided"}), 400
        
        filename = data['filename']
        file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
        
        def delete_operation():
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    rapid_file_transfer.emit_file_update('change', {
                        'filename': filename,
                        'action': 'deleted'
                    })
                    return {'status': f'File {filename} deleted successfully'}
                return {'error': 'File not found'}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_transfer_operation(delete_operation))
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/cleanup', methods=['POST'])
def cleanup_temp():
    """Clean up temporary directory and states only if transfer is not running"""
    try:
        def cleanup_operation():
            try:
                if not rapid_file_transfer.is_transfer_running:
                    # Remove all files in temp directory
                    for filename in os.listdir(rapid_file_transfer.temp_dir):
                        file_path = os.path.join(rapid_file_transfer.temp_dir, filename)
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                    
                    # Reset all states
                    rapid_file_transfer.device_progress.clear()
                    rapid_file_transfer.transferred_files.clear()
                    rapid_file_transfer.device_states.clear()
                    
                    rapid_file_transfer.emit_file_update('list', [])
                    return {'status': 'Cleanup completed successfully'}
                return {'error': 'Cleanup skipped - transfer is running'}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_transfer_operation(cleanup_operation))
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/get_files', methods=['GET'])
def get_files():
    """Get list of files in temporary directory"""
    try:
        def list_operation():
            try:
                files = []
                if os.path.exists(rapid_file_transfer.temp_dir):
                    files = [f for f in os.listdir(rapid_file_transfer.temp_dir) 
                            if os.path.isfile(os.path.join(rapid_file_transfer.temp_dir, f))]
                
                rapid_file_transfer.emit_file_update('list', files)
                return {'status': 'success', 'files': files}
            except Exception as e:
                return {'error': str(e)}

        return jsonify(execute_transfer_operation(list_operation))
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


