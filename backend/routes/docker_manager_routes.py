# backend/routes/docker_manager_routes.py

from flask import Blueprint, jsonify, request
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.docker.docker_checker import DockerChecker
from backend.services.scripts.system.thread_manager import ThreadManager
from backend.routes.socketio import socketio
from flask_socketio import Namespace

docker_manager_bp = Blueprint('service', __name__)
docker_manager = DockerManager()
docker_checker = DockerChecker()
thread_manager = ThreadManager()

class DockerManagerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_manager = DockerManager()
        self.docker_checker = DockerChecker()
        self.operation_in_progress = False
        self.last_status = None
        self.last_containers = None

    def on_connect(self):
        print('Client connected to /docker-manager namespace')
        try:
            # Get initial status
            status = self.docker_checker.get_status()
            self.emit_status_update(status, force=True)  # Force emit on connect
        except Exception as e:
            print(f"Error during connection setup: {str(e)}")
            self.emit_status_update({
                'isInstalled': False,
                'isRunning': False,
                'error': f"Error during connection setup: {str(e)}"
            }, force=True)

    def on_disconnect(self):
        print('Client disconnected from /docker-manager namespace')
        self.operation_in_progress = False
        self.last_status = None
        self.last_containers = None

    def on_request_initial_state(self):
        """Handle initial state request from client"""
        try:
            status = self.docker_checker.get_status()
            containers = []
            if status.get('isRunning'):
                containers = self.docker_manager.list_containers()
            
            initial_state = {
                'isInstalled': status['isInstalled'],
                'isRunning': status['isRunning'],
                'containers': containers,
                'error': status.get('error')
            }
            
            socketio.emit('initial_state', initial_state, namespace='/docker-manager')
        except Exception as e:
            error_state = {
                'isInstalled': False,
                'isRunning': False,
                'error': f"Error getting initial state: {str(e)}"
            }
            socketio.emit('initial_state', error_state, namespace='/docker-manager')

    def emit_status_update(self, status=None, force=False):
        """Emit Docker status updates only if there are changes"""
        try:
            if status is None:
                status = self.docker_checker.get_status()

            # Check if status has changed
            status_changed = force or self.last_status != status

            if status_changed:
                socketio.emit('docker_status', status, namespace='/docker-manager')
                self.last_status = status.copy() if status else None

            # If Docker is running, check containers
            if status.get('isRunning'):
                containers = self.docker_manager.list_containers()
                containers_changed = force or self.last_containers != containers

                if containers_changed:
                    socketio.emit('containers', {'containers': containers}, namespace='/docker-manager')
                    self.last_containers = containers.copy() if containers else None

        except Exception as e:
            print(f"Error emitting status update: {str(e)}")
            error_status = {
                'isInstalled': False,
                'isRunning': False,
                'error': f"Error checking Docker status: {str(e)}"
            }
            socketio.emit('docker_status', error_status, namespace='/docker-manager')
            self.last_status = None
            self.last_containers = None

    def _execute_operation(self, operation_func, *args, emit_events=True):
        """Execute a Docker operation in a thread-safe manner with proper event emission"""
        self.operation_in_progress = True
        try:
            result = operation_func(*args)
            if emit_events:
                self.emit_status_update()
            return result
        except Exception as e:
            error_message = str(e)
            if emit_events:
                error_status = {
                    'isInstalled': True,
                    'isRunning': False,
                    'error': error_message
                }
                self.emit_status_update(error_status)
            return {'error': error_message}
        finally:
            self.operation_in_progress = False

    def handle_docker_operation(self, operation_type, container_name=None):
        """Handle Docker operations (start/stop) for Docker daemon or containers"""
        try:
            if container_name:
                # Container operation
                operation_func = (self.docker_manager.start_container if operation_type == 'start' 
                                else self.docker_manager.stop_container)
                result = self._execute_operation(operation_func, container_name, emit_events=False)
                
                event_data = {
                    'status': 'error' if 'error' in result else 'success',
                    'message': result.get('error', result.get('status')),
                    'container': container_name
                }
                socketio.emit('container_operation', event_data, namespace='/docker-manager')
            else:
                # Docker daemon operation
                # Emit starting/stopping status
                socketio.emit('docker_operation', {
                    'isInstalled': True,
                    'isRunning': operation_type == 'stop',
                    'status': operation_type + 'ing'
                }, namespace='/docker-manager')
                
                operation_func = (self.docker_manager.start_docker if operation_type == 'start' 
                                else self.docker_manager.stop_docker)
                result = self._execute_operation(operation_func, emit_events=False)

                # Wait briefly for Docker state to stabilize
                socketio.sleep(2)
                current_status = self.docker_checker.get_status()
                
                expected_running = operation_type == 'start'
                event_data = {
                    'isInstalled': True,
                    'isRunning': current_status.get('isRunning', not expected_running),
                    'status': 'complete' if current_status.get('isRunning') == expected_running else operation_type + 'ing',
                    'error': result.get('error')
                }
                socketio.emit('docker_operation', event_data, namespace='/docker-manager')

            return result

        except Exception as e:
            error_message = f"Error during Docker {operation_type}: {str(e)}"
            error_status = {
                'isInstalled': True,
                'isRunning': operation_type == 'stop',
                'status': 'complete',
                'error': error_message
            }
            
            socketio.emit('docker_status', error_status, namespace='/docker-manager')
            event_name = 'container_operation' if container_name else 'docker_operation'
            event_data = {
                'status': 'error',
                'message': error_message
            }
            if container_name:
                event_data['container'] = container_name
                
            socketio.emit(event_name, event_data, namespace='/docker-manager')
            return {'error': error_message}

    def on_check_status(self, data=None):
        """Handle manual status check requests"""
        try:
            if not self.operation_in_progress:
                status = self.docker_checker.get_status()
                self.emit_status_update(status)
        except Exception as e:
            error_status = {
                'isInstalled': False,
                'isRunning': False,
                'error': f"Error checking Docker status: {str(e)}"
            }
            self.emit_status_update(error_status, force=True)

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
        docker_status = docker_checker.get_status()
        containers = docker_manager.list_containers() if docker_status['isRunning'] else []
        
        response_data = {
            'isInstalled': docker_status['isInstalled'],
            'isRunning': docker_status['isRunning'],
            'containers': containers,
            'error': docker_status.get('error')
        }
        
        namespace.emit_status_update(response_data)
        return jsonify(response_data)
    except Exception as e:
        error_response = {
            'isInstalled': False,
            'isRunning': False,
            'error': str(e)
        }
        return jsonify(error_response), 500

def execute_operation(operation_type, container_name=None):
    """Execute a Docker operation through the namespace"""
    namespace = get_docker_namespace()
    result = namespace.handle_docker_operation(operation_type, container_name)
    return jsonify({'message': result.get('status', 'Operation initiated successfully')})

@docker_manager_bp.route('/docker/start', methods=['POST'])
def start_docker():
    """Start Docker daemon"""
    return execute_operation('start')

@docker_manager_bp.route('/docker/stop', methods=['POST'])
def stop_docker():
    """Stop Docker daemon"""
    return execute_operation('stop')

@docker_manager_bp.route('/docker/containers/<container_name>/start', methods=['POST'])
def start_container(container_name):
    """Start a specific container"""
    return execute_operation('start', container_name)

@docker_manager_bp.route('/docker/containers/<container_name>/stop', methods=['POST'])
def stop_container(container_name):
    """Stop a specific container"""
    return execute_operation('stop', container_name)


