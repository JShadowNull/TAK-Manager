# backend/routes/data_package_route.py

from flask import Blueprint, request, jsonify
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.services.scripts.system.thread_manager import thread_manager
import uuid
import json
import os
from pathlib import Path
import logging

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
data_package_bp = Blueprint('data_package', __name__)
configurations = {}

# ============================================================================
# Helper Functions
# ============================================================================
def execute_data_package_operation(operation_func, operation_type: str, channel: str = None):
    """Execute a data package operation in a background thread"""
    def operation_thread():
        try:
            result = operation_func()
            if result and result.get('error'):
                return {'success': False, 'message': result['error']}
            return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error in {operation_type} operation: {error_message}")
            return {
                'success': False,
                'message': error_message
            }

    # Start the operation in a background thread
    thread_id = f"data_package_{operation_type}_{channel}" if channel else f"data_package_{operation_type}"
    thread = thread_manager.spawn(
        func=operation_thread,
        thread_id=thread_id,
        channel=channel or 'data-package'
    )
    
    return {'message': 'Operation initiated successfully'}

def normalize_preferences(preferences):
    """
    Normalize preferences data to ensure consistent format for multiple CoT streams.
    """
    normalized = {}
    stream_count = int(preferences.get('count', {}).get('value', 1))
    
    # Set count
    normalized['count'] = {'value': stream_count}
    
    # Preserve zip file name if present
    if '#zip_file_name' in preferences:
        normalized['#zip_file_name'] = preferences['#zip_file_name']
    
    # Base fields for each stream
    stream_fields = [
        'description',
        'enabled',
        'connectString',
        'caLocation',
        'certificateLocation',
        'clientPassword',
        'caPassword'
    ]
    
    # Process each stream
    for i in range(stream_count):
        # Preserve certificate markers for each stream
        cert_markers = [f'#ca_cert_name{i}', f'#client_cert_name{i}']
        for marker in cert_markers:
            if marker in preferences:
                normalized[marker] = preferences[marker]
        
        # Process regular fields
        for field in stream_fields:
            key = f"{field}{i}"
            if key in preferences:
                normalized[key] = preferences[key]
            else:
                # Set default values for missing fields
                if field == 'enabled':
                    normalized[key] = {'value': True}  # Default to enabled
                else:
                    normalized[key] = {'value': ''}
    
    return normalized

# ============================================================================
# Operation Handler
# ============================================================================
class DataPackageOperationHandler:
    def __init__(self, data_package_instance=None):
        self.data_package = data_package_instance or DataPackage()
        self.operation_in_progress = False

    def handle_configuration(self, preferences_data, channel: str = 'data-package'):
        """Handle data package configuration process"""
        try:
            self.operation_in_progress = True
            return self.data_package.main(preferences_data, channel=channel)
        except Exception as e:
            return {'error': str(e)}
        finally:
            self.operation_in_progress = False

    def handle_stop(self, channel: str = 'data-package'):
        """Handle stopping the data package configuration"""
        try:
            self.data_package.stop()
            return {'status': 'Configuration stopped successfully'}
        except Exception as e:
            return {'error': str(e)}

# ============================================================================
# HTTP Routes
# ============================================================================
@data_package_bp.route('/submit-preferences', methods=['POST'])
def submit_preferences():
    """Submit preferences for data package configuration"""
    try:
        configuration_id = str(uuid.uuid4())
        channel = request.args.get('channel', 'data-package')
        data_package = DataPackage()
        handler = DataPackageOperationHandler(data_package)
        configurations[configuration_id] = handler

        def configuration_operation():
            return handler.handle_configuration(request.json, channel=channel)

        operation_result = execute_data_package_operation(
            configuration_operation,
            'config',
            channel
        )
        
        return jsonify({
            'configuration_id': configuration_id,
            'message': operation_result.get('message', 'Configuration initiated'),
            'status': operation_result.get('status', 'pending')
        }), 200

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error processing request: {error_message}")
        return jsonify({"error": error_message}), 500

@data_package_bp.route('/stop', methods=['POST'])
def stop_data_package():
    """Stop data package configuration"""
    try:
        configuration_id = request.json.get('configuration_id')
        channel = request.args.get('channel', 'data-package')
        
        if not configuration_id:
            return jsonify({"error": "No configuration ID provided"}), 400

        if configuration_id not in configurations:
            return jsonify({"error": "Invalid configuration ID"}), 404

        handler = configurations[configuration_id]

        def stop_operation():
            result = handler.handle_stop(channel=channel)
            del configurations[configuration_id]
            return result

        operation_result = execute_data_package_operation(
            stop_operation,
            'stop',
            channel
        )
        return jsonify(operation_result), 200

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error stopping configuration: {error_message}")
        return jsonify({"error": error_message}), 500

@data_package_bp.route('/save-preferences', methods=['POST'])
def save_preferences():
    """Save preferences to a temporary file"""
    try:
        data = request.get_json()
        if not data or 'preferences' not in data:
            return jsonify({"error": "No preferences data provided"}), 400
            
        preferences = data['preferences']
        normalized_preferences = normalize_preferences(preferences)
        
        data_package = DataPackage()
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        prefs_file = temp_dir / 'data_package_preferences.json'
        with open(prefs_file, 'w') as f:
            json.dump(normalized_preferences, f, indent=2)
        
        return jsonify({"message": "Preferences saved successfully"}), 200
    except Exception as e:
        error_message = str(e)
        logger.error(f"Failed to save preferences: {error_message}")
        return jsonify({"error": error_message}), 500

@data_package_bp.route('/load-preferences', methods=['GET'])
def load_preferences():
    """Load preferences from the temporary file"""
    try:
        data_package = DataPackage()
        working_dir = Path(data_package.get_default_working_directory())
        temp_dir = working_dir / '.temp'
        prefs_file = temp_dir / 'data_package_preferences.json'
        
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        if prefs_file.exists():
            try:
                with open(prefs_file, 'r') as f:
                    preferences = json.load(f)
                    normalized_preferences = normalize_preferences(preferences)
                return jsonify({"preferences": normalized_preferences}), 200
            except json.JSONDecodeError:
                default_preferences = normalize_preferences({'count': {'value': 1}})
                return jsonify({"preferences": default_preferences}), 200
        
        default_preferences = normalize_preferences({'count': {'value': 1}})
        return jsonify({"preferences": default_preferences}), 200
    except Exception as e:
        error_message = str(e)
        logger.error(f"Failed to load preferences: {error_message}")
        return jsonify({"error": error_message}), 500

@data_package_bp.route('/certificate-files', methods=['GET'])
def get_certificate_files():
    """Get available certificate files"""
    try:
        channel = request.args.get('channel', 'data-package')
        data_package = DataPackage()
        cert_files = data_package.get_certificate_files(channel=channel)
        return jsonify({
            'success': True,
            'files': cert_files
        })
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting certificate files: {error_message}")
        return jsonify({
            'success': False,
            'message': error_message
        }), 500

