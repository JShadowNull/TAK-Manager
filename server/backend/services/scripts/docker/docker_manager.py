# backend/services/scripts/docker_manager.py

import docker
from flask_sse import sse
from backend.config.logging_config import configure_logging
import time

# Configure logging using centralized config
logger = configure_logging(__name__)

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()

    def _send_operation_status(self, operation_type: str, status: str, message: str, details: dict = None, channel: str = 'docker'):
        """Send operation status updates via SSE"""
        event_data = {
            'status': status,
            'operation': operation_type,
            'message': message,
            'details': details or {},
            'timestamp': time.time()
        }
        logger.debug(f"Sending operation status SSE event: {event_data}")
        sse.publish(event_data, type='docker_status')

    def start_container(self, container_name: str, channel: str = 'docker'):
        """Start a Docker container by its name."""
        try:
            # Start operation status
            self._send_operation_status(
                'start',
                'in_progress',
                f"Starting container {container_name}...",
                {'container': container_name}
            )

            container = self.client.containers.get(container_name)
            container.start()
            
            # Send success status
            success_msg = f"Container {container_name} started successfully."
            self._send_operation_status(
                'start',
                'completed',
                success_msg,
                {'container': container_name}
            )
            
            # Send updated container list
            self._send_containers_update()
            return {"status": success_msg}
            
        except docker.errors.NotFound:
            error = f"Container {container_name} not found"
            self._send_operation_status(
                'start',
                'error',
                error,
                {'container': container_name, 'error': error}
            )
            return {"error": error}
        except docker.errors.APIError as e:
            error = f"Error starting container {container_name}: {str(e)}"
            self._send_operation_status(
                'start',
                'error',
                error,
                {'container': container_name, 'error': str(e)}
            )
            return {"error": error}
        except Exception as e:
            error = f"Unexpected error starting container: {str(e)}"
            self._send_operation_status(
                'start',
                'error',
                error,
                {'container': container_name, 'error': str(e)}
            )
            return {"error": error}

    def stop_container(self, container_name: str, channel: str = 'docker'):
        """Stop a Docker container by its name."""
        try:
            # Start operation status
            self._send_operation_status(
                'stop',
                'in_progress',
                f"Stopping container {container_name}...",
                {'container': container_name}
            )

            container = self.client.containers.get(container_name)
            container.stop()
            
            # Send success status
            success_msg = f"Container {container_name} stopped successfully."
            self._send_operation_status(
                'stop',
                'completed',
                success_msg,
                {'container': container_name}
            )
            
            # Send updated container list
            self._send_containers_update()
            return {"status": success_msg}
            
        except docker.errors.NotFound:
            error = f"Container {container_name} not found"
            self._send_operation_status(
                'stop',
                'error',
                error,
                {'container': container_name, 'error': error}
            )
            return {"error": error}
        except docker.errors.APIError as e:
            error = f"Error stopping container {container_name}: {str(e)}"
            self._send_operation_status(
                'stop',
                'error',
                error,
                {'container': container_name, 'error': str(e)}
            )
            return {"error": error}

    def list_containers(self):
        """List Docker containers (running and non-running) with their status."""
        try:
            containers = self.client.containers.list(all=True)
            container_list = []
            for container in containers:
                state = container.attrs['State']
                container_list.append({
                    "id": container.id,
                    "name": container.name,
                    "status": container.status,
                    "state": state['Status'],
                    "running": state['Running'],
                    "started_at": state['StartedAt'],
                    "finished_at": state['FinishedAt'],
                    "image": container.image.tags[0] if container.image.tags else "none"
                })
            return container_list
        except docker.errors.APIError as e:
            logger.error(f"Error listing containers: {str(e)}")
            return []

    def _send_containers_update(self, channel: str = 'docker'):
        """Send updated container list via SSE"""
        try:
            containers = self.list_containers()
            event_data = {
                'type': 'container_update',
                'containers': containers,
                'timestamp': time.time()
            }
            logger.debug(f"Sending container update SSE event: {event_data}")
            sse.publish(event_data, type='docker_status')
        except Exception as e:
            error_msg = f"Error sending containers update: {str(e)}"
            logger.error(error_msg)
            error_data = {
                'type': 'error',
                'message': f'Error getting container list: {str(e)}',
                'containers': [],
                'timestamp': time.time()
            }
            logger.debug(f"Sending error SSE event: {error_data}")
            sse.publish(error_data, type='docker_status')

