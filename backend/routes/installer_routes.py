# backend/routes/installer_routes.py

from flask import Blueprint, render_template, jsonify, request
from backend.services.scripts.takserver.takserver_installer import TakServerInstaller
from backend.services.scripts.ota.ota_updates import OTAUpdate
import threading
import os
import uuid  # Import uuid to generate unique installation IDs
from backend.services.scripts.system.thread_manager import ThreadManager

# Define two separate blueprints for Docker and TAKServer
docker_bp = Blueprint('docker', __name__)
takserver_bp = Blueprint('takserver', __name__)
ota_update_bp = Blueprint('ota-update', __name__)

# Initialize ThreadManager
thread_manager = ThreadManager()

# Dictionary to keep track of running installations
installations = {}

# Route to serve the installers page (for both Docker and TAKServer)
@docker_bp.route('/installers', methods=['GET'])
def installers_page():
    return render_template('installers.html')

# Route to handle TAKServer installation
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
        name = data.get('name')  # Get the name from the request
        
        if not docker_zip_file or not postgres_password:
            return jsonify({"error": "Docker zip file and PostgreSQL password are required."}), 400

        # Save the uploaded Docker zip file to a temporary location
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        docker_zip_path = os.path.join(temp_dir, docker_zip_file.filename)
        docker_zip_file.save(docker_zip_path)

        # Generate a unique installation ID
        installation_id = str(uuid.uuid4())

        # Initialize the TakServerInstaller with the path to the zip file and password
        takserver_installer = TakServerInstaller(docker_zip_path, postgres_password, certificate_password, organization, state, city, organizational_unit, name)

        # Store the installer in the installations dictionary
        installations[installation_id] = takserver_installer

        # Start the installation process in a separate thread
        thread = threading.Thread(target=takserver_installer.main)
        thread.start()
        thread_manager.add_thread(thread)

        return jsonify({'message': 'TAKServer installation started!', 'installation_id': installation_id})

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer installation: {e}"}), 500

# Route to handle TAKServer rollback
@takserver_bp.route('/rollback-takserver', methods=['POST'])
def rollback_takserver():
    try:
        # Get the installation ID from the request
        data = request.get_json()
        installation_id = data.get('installation_id')

        if not installation_id:
            return jsonify({"error": "Installation ID is required."}), 400

        # Retrieve the installer from the installations dictionary
        takserver_installer = installations.get(installation_id)

        if not takserver_installer:
            return jsonify({"error": "No installation found with the provided ID."}), 400

        # Signal the installer to stop
        takserver_installer.stop_event.set()

        return jsonify({'message': 'TAKServer rollback initiated!'})

    except Exception as e:
        return jsonify({"error": f"Error during TAKServer rollback: {e}"}), 500

# Route to handle OTA update setup
@ota_update_bp.route('/setup-ota-update', methods=['POST'])
def setup_ota_update():
    try:
        # Get the uploaded OTA zip file from the request
        ota_zip_file = request.files.get('ota_zip_file')

        if not ota_zip_file:
            return jsonify({"error": "OTA zip file is required."}), 400

        # Save the uploaded OTA zip file to a temporary location
        temp_dir = '/tmp' if os.name != 'nt' else os.environ.get('TEMP', 'C:\\Temp')
        ota_zip_path = os.path.join(temp_dir, ota_zip_file.filename)
        ota_zip_file.save(ota_zip_path)

        # Generate a unique configuration ID
        configuration_id = str(uuid.uuid4())

        # Initialize the OTAUpdate instance with the path to the zip file
        ota_update = OTAUpdate(ota_zip_path)

        # Store the OTAUpdate instance in the installations dictionary
        installations[configuration_id] = ota_update

        # Start the OTA update setup process in a separate thread
        thread = threading.Thread(target=ota_update.main)
        thread.start()
        thread_manager.add_thread(thread)

        return jsonify({'message': 'OTA update setup started!', 'configuration_id': configuration_id})
    except Exception as e:
        return jsonify({"error": f"Error during OTA update setup: {e}"}), 500

# Route to handle OTA update rollback
@ota_update_bp.route('/rollback-ota-update', methods=['POST'])
def rollback_ota_update():
    try:
        # Get the configuration ID from the request
        data = request.get_json()
        configuration_id = data.get('configuration_id')

        if not configuration_id:
            return jsonify({"error": "Configuration ID is required."}), 400

        # Retrieve the OTAUpdate instance from the installations dictionary
        ota_update = installations.get(configuration_id)

        if not ota_update:
            return jsonify({"error": "No configuration found with the provided ID."}), 400

        # Signal the OTAUpdate instance to stop
        ota_update.stop_event.set()

        return jsonify({'message': 'OTA update rollback initiated!'})

    except Exception as e:
        return jsonify({"error": f"Error during OTA update rollback: {e}"}), 500

