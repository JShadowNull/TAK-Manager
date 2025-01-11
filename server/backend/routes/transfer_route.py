# Path: backend/routes/transfer_route.py

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from backend.services.scripts.transfer.transfer import RapidFileTransfer
from backend.services.scripts.system.thread_manager import ThreadManager
import os
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
def execute_transfer_operation(operation_func):
    """Execute a transfer operation in a background thread"""
    def operation_thread():
        try:
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

    # Spawn the operation in a background thread using thread_manager
    thread_manager.spawn(operation_func=operation_thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# HTTP Routes
# ============================================================================
@transfer_bp.route('/start_monitoring', methods=['POST'])
def start_monitoring():
    """Start device monitoring"""
    try:
        def monitor_operation():
            if not rapid_file_transfer.monitoring:
                rapid_file_transfer.start_monitoring()
                # Create and manage the monitoring thread
                thread_manager.spawn(
                    operation_func=rapid_file_transfer.monitor_devices
                )
                return {'status': 'Device monitoring started'}
            return {'status': 'Monitoring already active'}

        return jsonify(execute_transfer_operation(monitor_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/stop_monitoring', methods=['POST'])
def stop_monitoring():
    """Stop device monitoring"""
    try:
        def stop_operation():
            rapid_file_transfer.stop_monitoring()
            return {'status': 'Device monitoring stopped'}

        return jsonify(execute_transfer_operation(stop_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/start_transfer', methods=['POST'])
def start_transfer():
    """Start transfer for all connected devices"""
    try:
        def transfer_operation():
            # Get list of devices that need transfer
            device_ids = rapid_file_transfer.start_transfer_all_devices()
            
            if device_ids:
                # Create transfer threads for each device
                for device_id in device_ids:
                    thread_manager.spawn(
                        operation_func=lambda: rapid_file_transfer.start_transfer(device_id)
                    )
                return {'status': f'Transfer started for {len(device_ids)} device(s)'}
            return {'error': 'No devices available for transfer'}

        return jsonify(execute_transfer_operation(transfer_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/stop_transfer', methods=['POST'])
def stop_transfer():
    """Stop all ongoing transfers"""
    try:
        def stop_operation():
            rapid_file_transfer.stop_transfer()
            return {'status': 'Transfer stopped'}

        return jsonify(execute_transfer_operation(stop_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/get_status', methods=['GET'])
def get_status():
    """Get current transfer status"""
    try:
        def status_operation():
            rapid_file_transfer.get_transfer_status()
            return {'status': 'Status updated'}

        return jsonify(execute_transfer_operation(status_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@transfer_bp.route('/get_devices', methods=['GET'])
def get_devices():
    """Get list of connected devices"""
    try:
        def devices_operation():
            rapid_file_transfer.emit_connected_devices()
            return {'status': 'Device list updated'}

        return jsonify(execute_transfer_operation(devices_operation))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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


