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
        self.monitor_thread = None
        self.operation_in_progress = False
        self.operation_threads = []  # Track operation threads

    def cleanup_operation_threads(self):
        """Clean up completed operation threads"""
        self.operation_threads = [t for t in self.operation_threads if not t.dead]

    def on_connect(self):
        print('Client connected to /docker-manager namespace')
        if not self.monitor_thread:
            self.monitor_thread = socketio.start_background_task(self.monitor_docker_status)
            thread_manager.add_thread(self.monitor_thread)
        # Send immediate status update when client connects
        self.emit_status_update()

    def on_disconnect(self):
        print('Client disconnected from /docker-manager namespace')
        self.cleanup_operation_threads()

    def emit_status_update(self, status=None):
        """Emit Docker status updates"""
        if status is None:
            status = self.docker_checker.get_status()
        socketio.emit('docker_status', status, namespace='/docker-manager')

    def monitor_docker_status(self):
        """Monitor Docker status and containers"""
        last_status = None
        last_containers = None

        while True:
            try:
                # Skip status check if operation is in progress
                if not self.operation_in_progress:
                    # Get Docker status
                    docker_status = self.docker_checker.get_status()
                    current_status = docker_status['isRunning']
                    
                    # Emit status update if changed
                    if current_status != last_status:
                        self.emit_status_update(docker_status)
                        last_status = current_status

                    # Get and emit container list if Docker is running
                    if current_status:
                        current_containers = self.docker_manager.list_containers()
                        if current_containers != last_containers:
                            socketio.emit('containers', {'containers': current_containers}, namespace='/docker-manager')
                            last_containers = current_containers

            except Exception as e:
                error_status = {
                    'isInstalled': False,
                    'isRunning': False,
                    'error': f"Error checking Docker status: {str(e)}"
                }
                self.emit_status_update(error_status)

            socketio.sleep(2)

    def _execute_operation(self, operation_func, *args):
        """Execute a Docker operation in a thread-safe manner"""
        self.operation_in_progress = True
        try:
            result = operation_func(*args)
            return result
        finally:
            self.operation_in_progress = False
            # Force a status update after operation
            self.emit_status_update()

    def handle_docker_operation(self, operation_type, container_name=None):
        """Handle Docker operations (start/stop) for Docker daemon or containers"""
        try:
            if container_name:
                # Container operation
                if operation_type == 'start':
                    result = self._execute_operation(self.docker_manager.start_container, container_name)
                else:  # stop
                    result = self._execute_operation(self.docker_manager.stop_container, container_name)
                
                if 'error' in result:
                    socketio.emit('container_operation', {
                        'status': 'error',
                        'message': result['error'],
                        'container': container_name
                    }, namespace='/docker-manager')
                else:
                    socketio.emit('container_operation', {
                        'status': 'success',
                        'message': result['status'],
                        'container': container_name
                    }, namespace='/docker-manager')
            else:
                # Docker daemon operation
                if operation_type == 'start':
                    result = self._execute_operation(self.docker_manager.start_docker)
                else:  # stop
                    result = self._execute_operation(self.docker_manager.stop_docker)
                
                if 'error' in result:
                    socketio.emit('docker_operation', {
                        'status': 'error',
                        'message': result['error']
                    }, namespace='/docker-manager')
                else:
                    socketio.emit('docker_operation', {
                        'status': 'success',
                        'message': result['status']
                    }, namespace='/docker-manager')

            return result

        except Exception as e:
            error_message = f"Error during Docker {operation_type}: {str(e)}"
            if container_name:
                socketio.emit('container_operation', {
                    'status': 'error',
                    'message': error_message,
                    'container': container_name
                }, namespace='/docker-manager')
            else:
                socketio.emit('docker_operation', {
                    'status': 'error',
                    'message': error_message
                }, namespace='/docker-manager')
            return {'error': error_message}

    def on_check_status(self):
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
            self.emit_status_update(error_status)

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
        docker_status = docker_checker.get_status()
        containers = docker_manager.list_containers() if docker_status['isRunning'] else []
        
        response_data = {
            'isInstalled': docker_status['isInstalled'],
            'isRunning': docker_status['isRunning'],
            'containers': containers,
            'error': docker_status.get('error')
        }
        
        # Emit status update through namespace
        namespace = get_docker_namespace()
        namespace.emit_status_update(response_data)
        
        return jsonify(response_data)
    except Exception as e:
        error_message = str(e)
        error_response = {
            'isInstalled': False,
            'isRunning': False,
            'error': error_message
        }
        return jsonify(error_response), 500

def execute_docker_operation(operation_func):
    """Execute a Docker operation in a background thread"""
    namespace = get_docker_namespace()
    
    def operation_thread():
        try:
            result = operation_func()
            if result.get('error'):
                return {'success': False, 'message': result['error']}
            return {'success': True, 'message': result.get('status', 'Operation completed successfully')}
        finally:
            namespace.cleanup_operation_threads()
    
    # Spawn the operation in a background thread
    thread = thread_manager.spawn(operation_thread)
    namespace.operation_threads.append(thread)
    return {'message': 'Operation initiated successfully'}

@docker_manager_bp.route('/docker/start', methods=['POST'])
def start_docker():
    """Start Docker daemon"""
    namespace = get_docker_namespace()
    return jsonify(execute_docker_operation(
        lambda: namespace.handle_docker_operation('start')
    ))

@docker_manager_bp.route('/docker/stop', methods=['POST'])
def stop_docker():
    """Stop Docker daemon"""
    namespace = get_docker_namespace()
    return jsonify(execute_docker_operation(
        lambda: namespace.handle_docker_operation('stop')
    ))

@docker_manager_bp.route('/docker/containers/<container_name>/start', methods=['POST'])
def start_container(container_name):
    """Start a specific container"""
    namespace = get_docker_namespace()
    return jsonify(execute_docker_operation(
        lambda: namespace.handle_docker_operation('start', container_name)
    ))

@docker_manager_bp.route('/docker/containers/<container_name>/stop', methods=['POST'])
def stop_container(container_name):
    """Stop a specific container"""
    namespace = get_docker_namespace()
    return jsonify(execute_docker_operation(
        lambda: namespace.handle_docker_operation('stop', container_name)
    ))


