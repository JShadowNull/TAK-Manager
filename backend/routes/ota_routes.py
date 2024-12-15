from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from backend.services.scripts.ota.ota_updates import OTAUpdate
from backend.services.scripts.ota.ota_handler import OTAOperationHandler
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio

# Create blueprint for OTA routes
ota_bp = Blueprint('ota', __name__)

# Initialize thread manager
thread_manager = ThreadManager()

# Dictionary to keep track of running updates
updates = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

@ota_bp.route('/start-ota-update', methods=['POST'])
def start_ota_update():
    try:
        # Validate file exists in request
        if 'ota_zip_file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['ota_zip_file']
        
        # Validate filename
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload a ZIP file"}), 400

        # Create temp directory if it doesn't exist
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Save file with secure filename
        filename = secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)

        # Generate update ID
        update_id = str(uuid.uuid4())

        # Initialize OTA updater
        ota_updater = OTAUpdate(file_path)

        # Store updater instance
        updates[update_id] = ota_updater

        # Create handler and start update in managed thread
        handler = OTAOperationHandler(ota_updater)
        thread = thread_manager.spawn(handler.handle_update)

        return jsonify({
            'message': 'OTA update started',
            'update_id': update_id
        })

    except Exception as e:
        socketio.emit('ota_failed', {'error': str(e)}, namespace='/ota-update')
        return jsonify({"error": str(e)}), 500
    
@ota_bp.route('/update-ota', methods=['POST'])
def update_ota():
    try:
        # Validate file exists in request
        if 'ota_zip_file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['ota_zip_file']
        
        # Validate filename
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload a ZIP file"}), 400

        # Create temp directory if it doesn't exist
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Save file with secure filename
        filename = secure_filename(file.filename)
        file_path = os.path.join(temp_dir, filename)
        file.save(file_path)

        # Generate update ID
        update_id = str(uuid.uuid4())

        # Initialize OTA updater
        ota_updater = OTAUpdate(file_path)

        # Store updater instance
        updates[update_id] = ota_updater

        # Create handler and start update in managed thread
        handler = OTAOperationHandler(ota_updater)
        thread = thread_manager.spawn(handler.handle_update)

        return jsonify({
            'message': 'OTA update started',
            'update_id': update_id
        })

    except Exception as e:
        socketio.emit('ota_failed', {'error': str(e)}, namespace='/ota-update')
        return jsonify({"error": str(e)}), 500