# ============================================================================
# Imports
# ============================================================================
from flask import Blueprint, jsonify, request, current_app as app
from backend.services.scripts.cert_manager.certmanager import CertManager
from backend.services.helpers.operation_status import OperationStatus
from flask_socketio import Namespace
from backend.routes.socketio import socketio, safe_emit
from backend.services.scripts.system.thread_manager import ThreadManager
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import eventlet

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
certmanager_bp = Blueprint('certmanager', __name__)
thread_manager = ThreadManager()

# ============================================================================
# Constants and Shared Functions
# ============================================================================
def get_namespace(namespace_class):
    """Helper function to get a namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, namespace_class))
    except StopIteration:
        raise RuntimeError(f"{namespace_class.__name__} not found")

def create_operation_result(success, message, results=None):
    """Create a standardized operation result"""
    result = {
        'success': success,
        'message': message
    }
    if results is not None:
        result['results'] = results
    return result

def emit_to_namespace(event, data, namespace='/cert-manager'):
    """Helper function to emit events from HTTP context to WebSocket namespace"""
    try:
        # Get the namespace instance
        cert_namespace = get_namespace(CertManagerNamespace)
        # Use safe_emit to send the event
        safe_emit(event, data, namespace=namespace)
    except Exception as e:
        print(f"Error emitting event {event}: {str(e)}")

def execute_certmanager_operation(operation_func):
    """Execute a certificate manager operation in a background thread"""
    cert_namespace = get_namespace(CertManagerNamespace)
    
    def operation_thread():
        try:
            cert_namespace.start_operation()
            result = operation_func()
            
            if not result:
                return create_operation_result(False, 'Operation failed - no result returned')
            
            return create_operation_result(
                result.get('success', False),
                result.get('message', 'Operation completed'),
                result.get('results', [])
            )
            
        except Exception as e:
            error_message = str(e)
            return create_operation_result(False, error_message)
        finally:
            cert_namespace.end_operation()
            cert_namespace.cleanup_operation_threads()
    
    thread = thread_manager.spawn(operation_thread)
    cert_namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# Socket.IO Namespaces
# ============================================================================
class CertManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.cert_manager = CertManager()
        self.monitor_thread = None
        self.operation_in_progress = False
        self.operation_threads = []
        self.observer = None

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        # Remove dead threads
        self.operation_threads = [t for t in self.operation_threads if not t.dead]
        # Kill any remaining threads that are still alive
        for thread in self.operation_threads:
            try:
                if not thread.dead:
                    thread.kill()
            except Exception as e:
                print(f"Error killing thread: {e}")
        self.operation_threads = []

    def on_connect(self):
        """Start monitoring certificates when a client connects"""
        print('Client connected to /cert-manager namespace')
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_certificates)
            thread_manager.add_thread(self.monitor_thread)

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        print('Client requested initial state')
        try:
            certificates = self.cert_manager.get_registered_certificates()
            safe_emit('initial_state', {
                'certificates': certificates
            }, namespace='/cert-manager')
            # Also emit as certificates_data for immediate UI update
            safe_emit('certificates_data', {
                'certificates': certificates
            }, namespace='/cert-manager')
        except Exception as e:
            print(f"Error getting initial state: {e}")
            safe_emit('certificates_error', {
                'error': str(e)
            }, namespace='/cert-manager')

    def on_disconnect(self):
        """Clean up when client disconnects"""
        print('Client disconnected from /cert-manager namespace')
        self.cleanup_operation_threads()
        if self.monitor_thread and not self.monitor_thread.dead:
            try:
                self.monitor_thread.kill()
            except Exception as e:
                print(f"Error killing monitor thread: {e}")
        self.monitor_thread = None

    def monitor_certificates(self):
        """Monitor for certificate changes and emit updates."""
        last_certificates = None
        
        class CertificateChangeHandler(FileSystemEventHandler):
            def __init__(self, namespace):
                self.namespace = namespace
                
            def on_modified(self, event):
                if not event.is_directory and event.src_path == self.namespace.cert_manager.get_auth_file_path():
                    # File was modified, trigger certificate check
                    nonlocal last_certificates
                    try:
                        if not self.namespace.operation_in_progress:
                            current_certificates = self.namespace.cert_manager.get_registered_certificates()
                            if current_certificates != last_certificates:
                                safe_emit('certificates_data', 
                                    {'certificates': current_certificates}, 
                                    namespace='/cert-manager'
                                )
                                last_certificates = current_certificates
                    except Exception as e:
                        if not self.namespace.operation_in_progress:
                            safe_emit('certificates_error', 
                                {'error': str(e)}, 
                                namespace='/cert-manager'
                            )

        try:
            # Set up file watching
            auth_file = self.cert_manager.get_auth_file_path()
            event_handler = CertificateChangeHandler(self)
            self.observer = Observer()
            self.observer.schedule(event_handler, path=os.path.dirname(auth_file), recursive=False)
            self.observer.start()
            
            # Initial check
            if not self.operation_in_progress:
                current_certificates = self.cert_manager.get_registered_certificates()
                if current_certificates != last_certificates:
                    safe_emit('certificates_data', 
                        {'certificates': current_certificates}, 
                        namespace='/cert-manager'
                    )
                    last_certificates = current_certificates
            
            # Keep the thread alive without blocking
            while True:
                eventlet.sleep(1)
                
        except Exception as e:
            if not self.operation_in_progress:
                safe_emit('certificates_error', 
                    {'error': str(e)}, 
                    namespace='/cert-manager'
                )
            if self.observer:
                self.observer.stop()
                self.observer = None

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock and force a certificate update"""
        self.operation_in_progress = False

    def on_create_certificates(self, data):
        """Handle certificate creation request"""
        if not self.operation_in_progress:
            self.operation_in_progress = True
            
            def create_certificates_thread():
                try:
                    # Start the operation with initial status
                    self.operation_status.start_operation(
                        'certificate_creation',
                        'Starting certificate creation',
                        details={
                            'total': len(data) if isinstance(data, list) else 1,
                            'completed': 0,
                            'mode': 'batch' if isinstance(data, list) else 'single'
                        }
                    )

                    # Process the certificates
                    result = self.cert_manager.create_batch(data if isinstance(data, list) else [data])

                    # Handle the result
                    if result.get('success'):
                        self.operation_status.complete_operation(
                            'certificate_creation',
                            result.get('message', 'Certificates created successfully'),
                            details={
                                'total': len(data) if isinstance(data, list) else 1,
                                'completed': len(data) if isinstance(data, list) else 1,
                                'results': result.get('results', []),
                                'mode': 'batch' if isinstance(data, list) else 'single'
                            }
                        )
                    else:
                        self.operation_status.fail_operation(
                            'certificate_creation',
                            result.get('message', 'Certificate creation failed'),
                            details={
                                'error': result.get('message'),
                                'results': result.get('results', []),
                                'mode': 'batch' if isinstance(data, list) else 'single'
                            }
                        )
                except Exception as e:
                    self.operation_status.fail_operation(
                        'certificate_creation',
                        str(e),
                        details={
                            'error': str(e),
                            'mode': 'batch' if isinstance(data, list) else 'single'
                        }
                    )
                finally:
                    self.operation_in_progress = False
                    # Update certificate list after operation
                    self.get_certificates()

            thread = thread_manager.spawn(create_certificates_thread)
            self.operation_threads.append(thread)

# Register the certificate manager namespace
socketio.on_namespace(CertManagerNamespace('/cert-manager'))

# ============================================================================
# HTTP Routes
# ============================================================================
@certmanager_bp.route('/certmanager/create', methods=['POST'])
def create_certificates():
    """Create certificates - supports both single and batch operations"""
    try:
        data = request.get_json(force=True)
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

        # Get the cert manager instance
        cert_namespace = get_namespace(CertManagerNamespace)
        
        # Execute the operation
        def certificate_operation():
            return cert_namespace.cert_manager.create_batch(data['certificates'])

        result = execute_certmanager_operation(certificate_operation)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@certmanager_bp.route('/certmanager/delete', methods=['DELETE'])
def delete_certificates():
    """Delete certificates - supports both single and batch deletions"""
    try:
        data = request.get_json(force=True)
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

        # Get the cert manager instance
        cert_namespace = get_namespace(CertManagerNamespace)
        
        # Execute the deletion operation
        def delete_operation():
            if len(usernames) == 1:
                # Single deletion
                return cert_namespace.cert_manager.delete_main(usernames[0])
            else:
                # Batch deletion
                return cert_namespace.cert_manager.delete_batch(usernames)

        result = execute_certmanager_operation(delete_operation)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500