from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.scripts.takserver.takserver_handler import TakServerOperationHandler
import threading
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio

# Create blueprint for TAKServer routes
takserver_bp = Blueprint('takserver', __name__)

# Initialize managers and checkers
thread_manager = ThreadManager()
tak_status_checker = TakServerStatus()

# Dictionary to keep track of running installations
installations = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'zip'

@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
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

        # Store installer instance
        installation_id = str(uuid.uuid4())
        installations[installation_id] = installer

        # Create handler and start installation in managed thread
        handler = TakServerOperationHandler(installer)
        thread = thread_manager.spawn(handler.handle_installation)

        return jsonify({
            'message': 'TAK Server installation started',
            'installation_id': installation_id
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    try:
        handler = TakServerOperationHandler(tak_status_checker)
        thread = thread_manager.spawn(handler.handle_start)
        return jsonify({'message': 'TAK Server start initiated'})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-stop', methods=['POST'])
def stop_takserver():
    try:
        handler = TakServerOperationHandler(tak_status_checker)
        thread = thread_manager.spawn(handler.handle_stop)
        return jsonify({'message': 'TAK Server stop initiated'})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/takserver-restart', methods=['POST'])
def restart_takserver():
    try:
        handler = TakServerOperationHandler(tak_status_checker)
        thread = thread_manager.spawn(handler.handle_restart)
        return jsonify({'message': 'TAK Server restart initiated'})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@takserver_bp.route('/rollback-takserver', methods=['POST'])
def rollback_takserver():
    try:
        data = request.get_json()
        installation_id = data.get('installation_id')

        if not installation_id:
            return jsonify({"error": "Installation ID is required."}), 400

        takserver_installer = installations.get(installation_id)

        if not takserver_installer:
            return jsonify({"error": "No installation found with the provided ID."}), 400

        takserver_installer.stop_event.set()

        return jsonify({'message': 'TAKServer rollback initiated!'})

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer rollback: {e}"}), 500