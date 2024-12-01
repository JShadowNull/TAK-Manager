# backend/routes/installer_routes.py

from flask import Blueprint, render_template, jsonify, request
from backend.services.scripts.ota.ota_updates import OTAUpdate
import threading
import os
import uuid
from backend.services.scripts.system.thread_manager import ThreadManager

# Define blueprints
docker_bp = Blueprint('docker', __name__)
ota_update_bp = Blueprint('ota-update', __name__)

# Initialize ThreadManager
thread_manager = ThreadManager()

# Dictionary to keep track of running installations
installations = {}

# OTA update routes remain the same
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

