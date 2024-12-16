# ============================================================================
# Imports
# ============================================================================
from flask import Blueprint, request, jsonify
from flask_socketio import Namespace
from backend.services.scripts.cert_manager.certmanager import CertManager
from backend.routes.socketio import socketio
from backend.services.scripts.system.thread_manager import ThreadManager
import eventlet

# ============================================================================
# Blueprint and Global Variables
# ============================================================================
certmanager_routes = Blueprint('certmanager_routes', __name__)
cert_manager = CertManager()
thread_manager = ThreadManager()

# Dictionary to keep track of running operations
operations = {}

# ============================================================================
# Helper Functions
# ============================================================================
def get_certmanager_namespace():
    """Helper function to get the certificate manager namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, CertManagerNamespace))
    except StopIteration:
        raise RuntimeError("Certificate manager namespace not found")

def execute_certmanager_operation(operation_func):
    """Execute a certificate manager operation in a background thread"""
    namespace = get_certmanager_namespace()
    
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
    
    # Spawn the operation in a background thread using thread_manager
    thread = thread_manager.spawn(operation_thread)
    namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

# ============================================================================
# Socket.IO Namespace
# ============================================================================
class CertManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.cert_manager = CertManager()
        self.monitor_thread = None
        self.operation_in_progress = False
        self.operation_threads = []

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
        print('Client connected to /cert-manager namespace')
        if not self.monitor_thread:
            self.monitor_thread = thread_manager.spawn(self.monitor_certificates)
            thread_manager.add_thread(self.monitor_thread)
        # Send immediate update when client connects
        self.get_certificates()

    def on_disconnect(self):
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
        while True:
            try:
                if not self.operation_in_progress:
                    current_certificates = self.cert_manager.get_registered_certificates()
                    if current_certificates != last_certificates:
                        socketio.emit('certificates_data', 
                            {'certificates': current_certificates}, 
                            namespace='/cert-manager'
                        )
                        last_certificates = current_certificates
            except Exception as e:
                if not self.operation_in_progress:
                    socketio.emit('certificates_error', 
                        {'error': str(e)}, 
                        namespace='/cert-manager'
                    )
            eventlet.sleep(5)

    def get_certificates(self):
        """Handle manual certificate list requests."""
        try:
            if not self.operation_in_progress:
                certificates = self.cert_manager.get_registered_certificates()
                socketio.emit('certificates_data', 
                    {'certificates': certificates}, 
                    namespace='/cert-manager'
                )
        except Exception as e:
            socketio.emit('certificates_error', 
                {'error': str(e)}, 
                namespace='/cert-manager'
            )

    def start_operation(self):
        """Set the operation lock"""
        self.operation_in_progress = True

    def end_operation(self):
        """Release the operation lock and update status"""
        self.operation_in_progress = False
        # Force a status update after operation completes
        try:
            certificates = self.cert_manager.get_registered_certificates()
            socketio.emit('certificates_data', 
                {'certificates': certificates}, 
                namespace='/cert-manager'
            )
        except Exception as e:
            print(f"Error updating certificates after operation: {e}")

# Register the certificate manager namespace
socketio.on_namespace(CertManagerNamespace('/cert-manager'))

# ============================================================================
# Helper Functions for Certificate Validation
# ============================================================================
def validate_cert_data(cert_data):
    """Validate individual certificate data."""
    if not isinstance(cert_data, dict):
        return False, "Certificate data must be a dictionary"
        
    username = cert_data.get('username')
    if not username:
        return False, "Username is required"
        
    # Allow hyphens and underscores in username
    if not all(c.isalnum() or c in '-_' for c in username):
        return False, "Username must contain only letters, numbers, hyphens, and underscores"
        
    groups = cert_data.get('groups', ['__ANON__'])
    if not isinstance(groups, list):
        return False, "Groups must be a list"
        
    return True, None

# ============================================================================
# HTTP Routes
# ============================================================================
@certmanager_routes.route('/create', methods=['POST'])
def create_certificates():
    """Create certificates in either batch or single mode."""
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid request format'
            }), 400

        def create_operation():
            try:
                # Handle batch mode
                if all(key in data for key in ['name', 'count', 'prefixType']):
                    base_name = data['name'].strip()
                    group = data.get('group', '__ANON__').strip()
                    count = int(data['count'])
                    prefix_type = data['prefixType']
                    is_admin = data.get('isAdmin', False)
                    include_group = data.get('includeGroupInName', True)

                    # Validate base inputs
                    if not base_name:
                        return {'error': 'Base name is required'}

                    if not all(c.isalnum() or c in '-_' for c in base_name):
                        return {'error': 'Base name must contain only letters, numbers, hyphens, and underscores'}

                    if count < 1:
                        return {'error': 'Count must be greater than 0'}

                    certificates = []
                    # Generate certificate data based on prefix type
                    for i in range(1, count + 1):
                        suffix = chr(96 + i) if prefix_type == 'alpha' else str(i)
                        username = f"{base_name}-{group}-{suffix}" if include_group else f"{base_name}-{suffix}"
                        certificates.append({
                            'username': username,
                            'groups': [group],
                            'is_admin': is_admin
                        })
                    
                    # Use create_batch for batch mode
                    return cert_manager.create_batch(certificates)

                # Handle single/custom mode
                elif 'certificates' in data:
                    certificates = data['certificates']
                    if not isinstance(certificates, list) or not certificates:
                        return {'error': 'Certificates must be a non-empty list'}

                    # For single certificate, use create_main directly
                    if len(certificates) == 1:
                        cert_data = certificates[0]
                        return cert_manager.create_main(
                            username=cert_data['username'],
                            password=cert_data.get('password'),
                            is_admin=cert_data.get('is_admin', False),
                            groups=cert_data.get('groups', ['__ANON__'])
                        )
                    # For multiple certificates, use create_batch
                    else:
                        return cert_manager.create_batch(certificates)

                else:
                    return {'error': 'Invalid request format: missing required fields'}

            except Exception as e:
                return {'error': str(e)}

        operation_result = execute_certmanager_operation(create_operation)
        return jsonify(operation_result)

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error in certificate creation: {str(e)}'
        }), 500

@certmanager_routes.route('/delete', methods=['DELETE'])
def delete_certificates():
    """Delete multiple certificates and users."""
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            return jsonify({
                'success': False,
                'message': 'Invalid request format'
            }), 400

        def delete_operation():
            try:
                usernames = data.get('usernames', [])
                if not isinstance(usernames, list) or not usernames:
                    return {'error': 'Usernames must be a non-empty list'}

                results = []
                success_count = 0
                failure_count = 0

                for username in usernames:
                    if not username or not isinstance(username, str):
                        results.append({
                            'username': str(username),
                            'success': False,
                            'message': 'Invalid username format'
                        })
                        failure_count += 1
                        continue

                    result = cert_manager.delete_main(username=username)
                    results.append({
                        'username': username,
                        'success': result['success'],
                        'message': result['message']
                    })

                    if result['success']:
                        success_count += 1
                    else:
                        failure_count += 1

                return {
                    'status': f'Deleted {success_count} certificates, {failure_count} failures',
                    'results': results
                }

            except Exception as e:
                return {'error': str(e)}

        operation_result = execute_certmanager_operation(delete_operation)
        return jsonify(operation_result)

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error in batch certificate deletion: {str(e)}'
        }), 500