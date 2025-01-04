from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from backend.services.scripts.ota.ota_updates import OTAUpdate
from backend.services.helpers.operation_status import OperationStatus
from flask_socketio import Namespace
import os
import uuid
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
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

def get_upload_path():
    base_dir = '/home/tak-manager'
    upload_dir = os.path.join(base_dir, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

def process_ota_file(request):
    """Process and validate OTA file from request"""
    if 'ota_zip_file' not in request.files:
        raise ValueError("No file provided")
        
    file = request.files['ota_zip_file']
    
    if file.filename == '':
        raise ValueError("No file selected")
        
    if not allowed_file(file.filename):
        raise ValueError("Invalid file type. Please upload a ZIP file")

    upload_dir = get_upload_path()
    filename = secure_filename(file.filename)
    file_path = os.path.join(upload_dir, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
    file.save(file_path)
    
    return file_path

# ============================================================================
# Socket.IO Namespace
# ============================================================================
class OTAUpdateNamespace(Namespace):
    def __init__(self):
        super().__init__('/ota-update')
        self.operation_status = OperationStatus(namespace='/ota-update')

    def on_connect(self):
        """Handle client connection"""
        print('Client connected to /ota-update namespace')

    def on_disconnect(self):
        """Handle client disconnection"""
        print('Client disconnected from /ota-update namespace')

# Register Socket.IO namespace
socketio.on_namespace(OTAUpdateNamespace())

# ============================================================================
# HTTP Routes
# ============================================================================
@ota_bp.route('/ota-configure', methods=['POST'])
def configure_ota():
    """Handle initial OTA configuration"""
    try:
        try:
            file_path = process_ota_file(request)
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'status': 'error'
            }), 400

        update_id = str(uuid.uuid4())
        ota_updater = OTAUpdate(file_path)
        updates[update_id] = ota_updater

        def configuration_task():
            try:
                success = ota_updater.main()
                if success:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                return success
            except Exception as e:
                current_app.logger.error(f"Configuration error: {str(e)}")
                return False
            finally:
                if update_id in updates:
                    del updates[update_id]

        thread = thread_manager.spawn(configuration_task)
        return jsonify({
            'success': True,
            'update_id': update_id,
            'message': 'OTA configuration initiated',
            'status': 'pending',
            'progress': 0
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error'
        }), 500

@ota_bp.route('/ota-update', methods=['POST'])
def update_ota():
    """Handle OTA plugin updates"""
    try:
        try:
            file_path = process_ota_file(request)
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'status': 'error'
            }), 400

        update_id = str(uuid.uuid4())
        ota_updater = OTAUpdate(file_path)
        updates[update_id] = ota_updater

        def update_task():
            try:
                success = ota_updater.update()
                if success:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                return success
            except Exception as e:
                current_app.logger.error(f"Update error: {str(e)}")
                return False
            finally:
                if update_id in updates:
                    del updates[update_id]

        thread = thread_manager.spawn(update_task)
        return jsonify({
            'success': True,
            'update_id': update_id,
            'message': 'OTA update initiated',
            'status': 'pending',
            'progress': 0
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error'
        }), 500

@ota_bp.route('/ota-update-progress/<update_id>', methods=['GET'])
def get_update_progress(update_id):
    """Get progress of current OTA update or configuration"""
    try:
        updater = updates.get(update_id)
        if not updater:
            return jsonify({
                'success': False,
                'error': 'Update not found',
                'status': 'not_found',
                'progress': 0
            }), 404

        progress_info = updater.get_progress()
        status = progress_info.get('status', 'idle')
        progress = progress_info.get('progress', 0)

        response = {
            'success': True,
            'status': status,
            'progress': progress,
            'message': progress_info.get('message', '')
        }

        if status == 'complete':
            response['message'] = 'Operation completed successfully'
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