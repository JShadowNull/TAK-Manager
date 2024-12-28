# backend/routes/docker_manager_routes.py

from flask import Blueprint, jsonify, request
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio
from flask_socketio import Namespace

docker_manager_bp = Blueprint('service', __name__)
docker_manager = DockerManager()
thread_manager = ThreadManager()

class DockerManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_manager = DockerManager()
        self.last_containers = None

    def on_connect(self):
        print('Client connected to /docker-manager namespace')
        try:
            containers = self.docker_manager.list_containers()
            initial_state = {
                'containers': containers,
                'error': None
            }
            socketio.emit('initial_state', initial_state, namespace='/docker-manager')
        except Exception as e:
            print(f"Error during connection setup: {str(e)}")
            error_state = {
                'containers': [],
                'error': f"Error during connection setup: {str(e)}"
            }
            socketio.emit('initial_state', error_state, namespace='/docker-manager')

    def on_disconnect(self):
        print('Client disconnected from /docker-manager namespace')
        self.last_containers = None

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        try:
            containers = self.docker_manager.list_containers()
            initial_state = {
                'containers': containers,
                'error': None
            }
            socketio.emit('initial_state', initial_state, namespace='/docker-manager')
        except Exception as e:
            error_state = {
                'containers': [],
                'error': f"Error getting initial state: {str(e)}"
            }
            socketio.emit('initial_state', error_state, namespace='/docker-manager')

    def emit_status_update(self, status=None, force=False):
        """Emit Docker status updates only if there are changes"""
        try:
            containers = self.docker_manager.list_containers()
            containers_changed = force or self.last_containers != containers

            if containers_changed:
                socketio.emit('containers', {'containers': containers}, namespace='/docker-manager')
                self.last_containers = containers.copy() if containers else None

        except Exception as e:
            print(f"Error emitting status update: {str(e)}")
            error_status = {
                'containers': [],
                'error': f"Error checking Docker status: {str(e)}"
            }
            socketio.emit('docker_status', error_status, namespace='/docker-manager')
            self.last_containers = None

    def handle_docker_operation(self, operation_type, container_name):
        """Handle Docker operations (start/stop) for containers"""
        try:
            # Initialize status helper for the operation
            self.docker_manager.initialize_status_helper(socketio)
            
            # Container operation
            operation_func = (self.docker_manager.start_container if operation_type == 'start' 
                            else self.docker_manager.stop_container)
            result = operation_func(container_name)
            
            # Emit status update after operation
            self.emit_status_update(force=True)
            
            return result

        except Exception as e:
            error_message = f"Error during Docker {operation_type}: {str(e)}"
            print(f"[DockerManager] {error_message}")
            return {'error': error_message}

# Register the docker manager namespace
socketio.on_namespace(DockerManagerNamespace('/docker-manager'))

def get_docker_namespace():
    """Helper function to get the Docker manager namespace instance"""
    try:
        return next(ns for ns in socketio.server.namespace_handlers.values() 
                   if isinstance(ns, DockerManagerNamespace))
    except StopIteration:
        raise RuntimeError("Docker manager namespace not found")

@docker_manager_bp.route('/docker/status', methods=['GET'])
def check_docker_status():
    """Get current Docker status and list of containers"""
    try:
        namespace = get_docker_namespace()
        containers = docker_manager.list_containers()
        
        response_data = {
            'containers': containers,
            'error': None
        }
        
        namespace.emit_status_update(response_data)
        return jsonify(response_data)
    except Exception as e:
        error_response = {
            'containers': [],
            'error': str(e)
        }
        return jsonify(error_response), 500

def execute_operation(operation_type, container_name):
    """Execute a Docker operation through the namespace"""
    try:
        namespace = get_docker_namespace()
        
        # Initialize docker manager's status helper
        namespace.docker_manager.initialize_status_helper(socketio)
        
        result = namespace.handle_docker_operation(operation_type, container_name)
        
        if 'error' in result:
            print(f"[DockerManager] Operation failed: {result['error']}")
            return jsonify({'error': result['error']}), 500
            
        return jsonify({
            'message': result.get('status', 'Operation initiated successfully'),
            'status': 'success'
        })
    except Exception as e:
        error_msg = f"Failed to execute {operation_type} operation: {str(e)}"
        print(f"[DockerManager] Error: {error_msg}")
        return jsonify({'error': error_msg}), 500

@docker_manager_bp.route('/docker/containers/<container_name>/start', methods=['POST'])
def start_container(container_name):
    """Start a specific container"""
    return execute_operation('start', container_name)

@docker_manager_bp.route('/docker/containers/<container_name>/stop', methods=['POST'])
def stop_container(container_name):
    """Stop a specific container"""
    return execute_operation('stop', container_name)


