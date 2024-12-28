# backend/routes/data_package_route.py

from flask import Blueprint, render_template, request, jsonify
from backend.services.scripts.data_package_config.data_package import DataPackage
from backend.services.scripts.system.thread_manager import ThreadManager
from flask_socketio import Namespace
from backend.routes.socketio import socketio
import eventlet
import uuid
import json
import os
from pathlib import Path

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
data_package_bp = Blueprint('data_package', __name__)
thread_manager = ThreadManager()
configurations = {}

# ============================================================================
# Helper Functions
# ============================================================================
def get_data_package_namespace():
    """Helper function to get the data package namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, DataPackageNamespace))
    except StopIteration:
        raise RuntimeError("Data package namespace not found")

def execute_data_package_operation(operation_func):
    """Execute a data package operation in a background thread"""
    namespace = get_data_package_namespace()
    
    def operation_thread():
        try:
            namespace.start_operation()
            result = operation_func()
            if result and result.get('error'):
                return {'success': False, 'message': result['error']}
            return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
        except Exception as e:
            return {'success': False, 'message': str(e)}
        finally:
            namespace.end_operation()
            namespace.cleanup_operation_threads()
    
    thread = thread_manager.spawn(operation_thread)
    namespace.operation_threads.append(thread)
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
# Socket.IO Namespace
# ============================================================================
class DataPackageNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.data_package = DataPackage()
        self.monitor_thread = None
        self.operation_in_progress = False
        self.operation_threads = []

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        self.operation_threads = [t for t in self.operation_threads if not t.dead]
        for thread in self.operation_threads:
            try:
                if not thread.dead:
                    thread.kill()
            except Exception as e:
                print(f"Error killing thread: {e}")
        self.operation_threads = []

    def on_connect(self):
        print('Client connected to /data-package namespace')
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_status)
            thread_manager.add_thread(self.monitor_thread)

    def on_disconnect(self):
        print('Client disconnected from /data-package namespace')
        self.cleanup_operation_threads()
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def monitor_status(self):
        """Monitor data package configuration status"""
        while True:
            try:
                if self.operation_in_progress:
                    # No need to emit status as frontend doesn't use it
                    pass
            except Exception as e:
                print(f"Monitor status error: {e}")  # Just log the error
            eventlet.sleep(2)
            
    def on_get_certificate_files(self):
        """Handle request for certificate files"""
        try:
            self.data_package.get_certificate_files()
        except Exception as e:
            # Let data_package.py handle the error emission
            raise  # Re-raise to let data_package.py handle it

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock"""
        self.operation_in_progress = False

# Register the namespace
socketio.on_namespace(DataPackageNamespace('/data-package'))

# ============================================================================
# Operation Handler
# ============================================================================
class DataPackageOperationHandler:
    def __init__(self, data_package_instance=None):
        self.data_package = data_package_instance or DataPackage()
        self.operation_in_progress = False

    def handle_configuration(self, preferences_data):
        """Handle data package configuration process"""
        try:
            self.operation_in_progress = True
            return self.data_package.main(preferences_data)
        except Exception as e:
            return {'error': str(e)}
        finally:
            self.operation_in_progress = False

    def handle_stop(self):
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
        data_package = DataPackage()
        handler = DataPackageOperationHandler(data_package)
        configurations[configuration_id] = handler

        def configuration_operation():
            return handler.handle_configuration(request.json)

        operation_result = execute_data_package_operation(configuration_operation)
        return jsonify({
            'configuration_id': configuration_id,
            'message': operation_result.get('message', 'Configuration initiated'),
            'status': operation_result.get('status', 'pending')
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500

@data_package_bp.route('/stop', methods=['POST'])
def stop_data_package():
    """Stop data package configuration"""
    try:
        configuration_id = request.json.get('configuration_id')
        if not configuration_id:
            return jsonify({"error": "No configuration ID provided"}), 400

        if configuration_id not in configurations:
            return jsonify({"error": "Invalid configuration ID"}), 404

        handler = configurations[configuration_id]

        def stop_operation():
            result = handler.handle_stop()
            del configurations[configuration_id]
            return result

        operation_result = execute_data_package_operation(stop_operation)
        return jsonify(operation_result), 200

    except Exception as e:
        return jsonify({"error": f"Error stopping configuration: {str(e)}"}), 500

@data_package_bp.route('/save-preferences', methods=['POST'])
def save_preferences():
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
        return jsonify({"error": f"Failed to save preferences: {str(e)}"}), 500

@data_package_bp.route('/load-preferences', methods=['GET'])
def load_preferences():
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
            except json.JSONDecodeError as e:
                default_preferences = normalize_preferences({'count': {'value': 1}})
                return jsonify({"preferences": default_preferences}), 200
        
        default_preferences = normalize_preferences({'count': {'value': 1}})
        return jsonify({"preferences": default_preferences}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to load preferences: {str(e)}"}), 500

