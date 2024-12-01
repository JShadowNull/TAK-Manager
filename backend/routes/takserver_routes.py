from flask import Blueprint, jsonify, request
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
import threading
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager

# Create blueprint for TAKServer routes
takserver_bp = Blueprint('takserver', __name__)

# Initialize ThreadManager
thread_manager = ThreadManager()

# Dictionary to keep track of running installations
installations = {}

@takserver_bp.route('/install-takserver', methods=['POST'])
def install_takserver():
    try:
        # Get the uploaded file and password from the request
        data = request.form
        docker_zip_file = request.files.get('docker_zip_file')
        postgres_password = data.get('postgres_password')
        certificate_password = data.get('certificate_password')
        organization = data.get('organization')
        state = data.get('state')
        city = data.get('city')
        organizational_unit = data.get('organizational_unit')
        name = data.get('name')
        
        if not docker_zip_file or not postgres_password:
            return jsonify({"error": "Docker zip file and PostgreSQL password are required."}), 400

        # Save the uploaded Docker zip file to a temporary location
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        docker_zip_path = os.path.join(temp_dir, docker_zip_file.filename)
        docker_zip_file.save(docker_zip_path)

        # Generate a unique installation ID
        installation_id = str(uuid.uuid4())

        # Initialize the TakServerInstaller
        takserver_installer = TakServerInstaller(
            docker_zip_path, 
            postgres_password, 
            certificate_password, 
            organization, 
            state, 
            city, 
            organizational_unit, 
            name
        )

        # Store the installer in the installations dictionary
        installations[installation_id] = takserver_installer

        # Start the installation process in a separate thread
        thread = threading.Thread(target=takserver_installer.main)
        thread.start()
        thread_manager.add_thread(thread)

        return jsonify({
            'message': 'TAKServer installation started!', 
            'installation_id': installation_id
        })

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer installation: {e}"}), 500

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

@takserver_bp.route('/takserver-start', methods=['POST'])
def start_takserver():
    try:
        # Add your takserver start logic here
        return jsonify({'message': 'TAKServer started successfully'})
    except Exception as e:
        return jsonify({"error": f"Error starting TAKServer: {e}"}), 500

@takserver_bp.route('/takserver-stop', methods=['POST'])
def stop_takserver():
    try:
        # Add your takserver stop logic here
        return jsonify({'message': 'TAKServer stopped successfully'})
    except Exception as e:
        return jsonify({"error": f"Error stopping TAKServer: {e}"}), 500

@takserver_bp.route('/takserver-status', methods=['GET'])
def get_status():
    try:
        # Add your status check logic here
        status = {
            'installed': True,  # Replace with actual check
            'running': True,    # Replace with actual check
        }
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": f"Error checking TAKServer status: {e}"}), 500 