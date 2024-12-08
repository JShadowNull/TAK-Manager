# backend/routes/data_package_route.py

from flask import Blueprint, render_template, request, jsonify
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.services.scripts.system.thread_manager import ThreadManager
import threading
import uuid
import json
import os
from pathlib import Path

# Initialize ThreadManager
thread_manager = ThreadManager()

# Dictionary to keep track of running installations
installations = {}

data_package_bp = Blueprint('data_package', __name__)

# Route to render the Docker management page
@data_package_bp.route('/configure-data-package')
def data_package_page():
    return render_template('data_package/data_package.html')

# Route to handle the form submission from the frontend
@data_package_bp.route('/submit-preferences', methods=['POST'])
def submit_preferences():
    try:
        # Log the incoming request
        print("Received preferences submission")
        print("Request JSON:", request.json)

        # Generate unique configuration ID
        configuration_id = str(uuid.uuid4())
        print(f"Generated configuration ID: {configuration_id}")

        # Initialize DataPackage instance
        data_package = DataPackage()
        preferences_data = request.json

        if not preferences_data:
            raise ValueError("No preferences data provided")

        # Store the data package instance
        installations[configuration_id] = data_package
        print(f"Stored data package instance for ID: {configuration_id}")

        # Start configuration in separate thread
        thread = threading.Thread(target=data_package.main, args=(preferences_data,))
        thread.start()
        thread_manager.add_thread(thread)
        print("Configuration thread started")

        return jsonify({
            'message': 'Data package configuration started!',
            'configuration_id': configuration_id
        }), 200

    except Exception as e:
        print(f"Error in submit_preferences: {str(e)}")
        error_msg = f"Error processing request: {str(e)}"
        return jsonify({"error": error_msg}), 500

# Route to handle stopping the configuration
@data_package_bp.route('/stop', methods=['POST'])
def stop_data_package():
    try:
        configuration_id = request.json.get('configuration_id')
        if not configuration_id:
            return jsonify({"error": "No configuration ID provided"}), 400

        if configuration_id not in installations:
            return jsonify({"error": "Invalid configuration ID"}), 404

        # Get the data package instance and stop it
        data_package = installations[configuration_id]
        data_package.stop()

        # Clean up
        del installations[configuration_id]

        return jsonify({"message": "Configuration stopped successfully"}), 200

    except Exception as e:
        error_msg = f"Error stopping configuration: {str(e)}"
        return jsonify({"error": error_msg}), 500

@data_package_bp.route('/save-preferences', methods=['POST'])
def save_preferences():
    try:
        data = request.get_json()
        if not data or 'preferences' not in data:
            return jsonify({"error": "No preferences data provided"}), 400
            
        preferences = data['preferences']
        data_package = DataPackage()
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        prefs_file = temp_dir / 'data_package_preferences.json'
        with open(prefs_file, 'w') as f:
            json.dump(preferences, f, indent=2)
        
        return jsonify({"message": "Preferences saved successfully"}), 200
    except Exception as e:
        print(f"Error saving preferences: {str(e)}")
        return jsonify({"error": f"Failed to save preferences: {str(e)}"}), 500

@data_package_bp.route('/load-preferences', methods=['GET'])
def load_preferences():
    try:
        data_package = DataPackage()
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        prefs_file = temp_dir / 'data_package_preferences.json'
        
        # Create directory if it doesn't exist
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        if prefs_file.exists():
            try:
                with open(prefs_file, 'r') as f:
                    preferences = json.load(f)
                return jsonify({"preferences": preferences}), 200
            except json.JSONDecodeError as e:
                print(f"Invalid JSON in preferences file: {str(e)}")
                return jsonify({"preferences": {}}), 200
        return jsonify({"preferences": {}}), 200
    except Exception as e:
        print(f"Error loading preferences: {str(e)}")
        return jsonify({"error": f"Failed to load preferences: {str(e)}"}), 500

