# ============================================================================
# Imports
# ============================================================================
from flask import Blueprint, jsonify, request, current_app
from backend.services.scripts.cert_manager.certmanager import CertManager
from backend.services.scripts.system.thread_manager import thread_manager
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import logging

# Configure logger
logger = logging.getLogger(__name__)

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
certmanager_bp = Blueprint('certmanager', __name__)
cert_manager = CertManager()

# ============================================================================
# File Monitoring
# ============================================================================
class CertificateChangeHandler(FileSystemEventHandler):
    def __init__(self, cert_manager):
        self.cert_manager = cert_manager
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.cert_manager.get_auth_file_path():
            try:
                # Get and send updated certificates
                certificates = self.cert_manager.get_registered_certificates()
                self.cert_manager._send_certificates_update(certificates)
            except Exception as e:
                logger.error(f"Error handling certificate file change: {e}")

def setup_certificate_monitoring():
    """Setup file monitoring for certificate changes"""
    try:
        auth_file = cert_manager.get_auth_file_path()
        event_handler = CertificateChangeHandler(cert_manager)
        observer = Observer()
        observer.schedule(event_handler, path=os.path.dirname(auth_file), recursive=False)
        observer.start()
        return observer
    except Exception as e:
        logger.error(f"Error setting up certificate monitoring: {e}")
        return None

# ============================================================================
# Helper Functions
# ============================================================================
def execute_cert_operation(operation_func, operation_type: str, channel: str = None):
    """Execute a certificate operation in a background thread"""
    def operation_thread():
        try:
            result = operation_func()
            return result
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error in {operation_type} operation: {error_message}")
            return {
                'success': False,
                'message': error_message
            }

    # Start the operation in a background thread
    thread_id = f"cert_{operation_type}_{channel}" if channel else f"cert_{operation_type}"
    thread_manager.spawn(
        func=operation_thread,
        thread_id=thread_id,
        channel=channel or 'cert-manager'
    )
    
    return {
        'success': True,
        'message': f'{operation_type} operation initiated'
    }

# ============================================================================
# Routes
# ============================================================================
@certmanager_bp.route('/certmanager/certificates', methods=['GET'])
def get_certificates():
    """Get all registered certificates"""
    try:
        channel = request.args.get('channel', 'cert-manager')
        certificates = cert_manager.get_registered_certificates(channel=channel)
        return jsonify({
            'success': True,
            'certificates': certificates
        })
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error getting certificates: {error_message}")
        return jsonify({
            'success': False,
            'message': error_message
        }), 500

@certmanager_bp.route('/certmanager/create', methods=['POST'])
def create_certificates():
    """Create certificates - supports both single and batch operations"""
    try:
        data = request.get_json(force=True)
        channel = request.args.get('channel', 'cert-manager')
        
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Handle batch mode with name prefix
        if 'name' in data:
            certificates = []
            count = data.get('count', 1)
            base_name = data.get('name', '')
            group = data.get('group', '__ANON__')
            prefix_type = data.get('prefixType', 'numeric')
            is_admin = data.get('isAdmin', False)
            
            # Validate inputs
            is_valid, error = cert_manager.validate_batch_inputs(base_name, count, group)
            if not is_valid:
                return jsonify({"error": error}), 400
            
            for i in range(count):
                suffix = chr(97 + i) if prefix_type == 'alpha' else str(i + 1)
                cert_name = f"{base_name}-{group}-{suffix}"
                certificates.append({
                    'username': cert_name,
                    'groups': [group],
                    'is_admin': is_admin
                })
            
            data = {'certificates': certificates}
        
        # Validate certificates data
        if 'certificates' not in data:
            return jsonify({"error": "Missing required field: certificates"}), 400
        
        if not isinstance(data['certificates'], list):
            return jsonify({"error": "Certificates must be a list"}), 400
        
        if not data['certificates']:
            return jsonify({"error": "Certificates list is empty"}), 400

        # Validate each certificate entry
        for i, cert in enumerate(data['certificates']):
            if not isinstance(cert, dict):
                return jsonify({"error": "Each certificate must be an object"}), 400
            
            if 'username' not in cert:
                return jsonify({"error": f"Missing username in certificate {i + 1}"}), 400
            
            if not isinstance(cert.get('groups', []), list):
                return jsonify({"error": f"Invalid groups type in certificate {i + 1}"}), 400

        # Execute the operation
        return jsonify(execute_cert_operation(
            lambda: cert_manager.create_batch(data['certificates'], channel=channel),
            'create',
            channel
        ))

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error creating certificates: {error_message}")
        return jsonify({
            'success': False,
            'message': error_message
        }), 500

@certmanager_bp.route('/certmanager/delete', methods=['DELETE'])
def delete_certificates():
    """Delete certificates - supports both single and batch deletions"""
    try:
        data = request.get_json(force=True)
        channel = request.args.get('channel', 'cert-manager')
        
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate usernames data
        if 'usernames' not in data:
            return jsonify({"error": "Missing required field: usernames"}), 400
        
        usernames = data['usernames']
        if not isinstance(usernames, list):
            return jsonify({"error": "Usernames must be a list"}), 400
        
        if not usernames:
            return jsonify({"error": "Usernames list is empty"}), 400

        # Execute the deletion operation
        operation_func = (
            lambda: cert_manager.delete_main(usernames[0], channel=channel)
            if len(usernames) == 1
            else lambda: cert_manager.delete_batch(usernames, channel=channel)
        )

        return jsonify(execute_cert_operation(
            operation_func,
            'delete',
            channel
        ))

    except Exception as e:
        error_message = str(e)
        logger.error(f"Error deleting certificates: {error_message}")
        return jsonify({
            'success': False,
            'message': error_message
        }), 500

# Initialize certificate monitoring
observer = setup_certificate_monitoring()