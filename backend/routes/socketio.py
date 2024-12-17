# backend/services/socketio_handler.py

from flask_socketio import SocketIO, Namespace
from backend.services.scripts.system.thread_manager import thread_manager
from backend.services.scripts.docker.docker_manager import DockerManager
import eventlet
import os

# Initialize SocketIO with eventlet
socketio = SocketIO(
    async_mode='eventlet',
    engineio_logger=False,
    logger=False,
    ping_timeout=60,
    cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    path='/socket.io',
    manage_session=False,
    always_connect=True,
    max_http_buffer_size=1e8,
    async_handlers=True,
    allow_upgrades=True,
    transports=['websocket']
)

def safe_emit(event, data, namespace=None, broadcast=False):
    """Thread-safe emit function using eventlet"""
    try:
        if broadcast:
            socketio.emit(event, data, namespace=namespace)
        else:
            socketio.emit(event, data, namespace=namespace, include_self=True)
    except Exception as e:
        print(f"Error in safe_emit: {e}")

# Docker Installer Socket
from backend.services.helpers.docker_installer import DockerInstaller

# DockerInstallerNamespace handles the Docker installation process
class DockerInstallerNamespace(Namespace):
    def __init__(self, namespace=None):
        super().__init__(namespace)
        self.docker_installer = DockerInstaller()

    def on_connect(self):
        print("Client connected to Docker installer namespace")

    def on_disconnect(self):
        print("Client disconnected from Docker installer namespace")

    def on_check_docker_installed(self):
        print('Received request to check if Docker is installed')
        result = self.docker_installer.is_docker_installed()
        socketio.emit('docker_installed_status', result, namespace='/docker-installer')

# Register the docker installer namespace
socketio.on_namespace(DockerInstallerNamespace('/docker-installer'))