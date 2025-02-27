# backend/services/scripts/docker_manager.py

import docker
from typing import Dict, Any, AsyncGenerator, Optional, Callable
import json
import asyncio
from backend.config.logging_config import configure_logging
import time
from sse_starlette.sse import ServerSentEvent

logger = configure_logging(__name__)

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
        self._operation_states = {}  # Track operations by container name

    def get_container_status(self):
        """Get current container list with operation states"""
        containers = []
        for container in self.client.containers.list(all=True):
            container_info = {
                'id': container.id,
                'name': container.name,
                'status': container.status,
                'state': container.status,
                'running': container.status == 'running',
                'image': container.image.tags[0] if container.image.tags else 'none',
                'operation': self._operation_states.get(container.name)
            }
            containers.append(container_info)

        return {
            'type': 'container_status',
            'containers': containers,
            'timestamp': time.time()
        }

    async def status_generator(self):
        """Generate container status events every 5 seconds"""
        while True:
            yield self.get_container_status()
            await asyncio.sleep(5)

    async def start_container(self, container_name: str):
        """Start a container and track its operation state"""
        try:
            container = self.client.containers.get(container_name)
            self._operation_states[container_name] = {'action': 'start', 'status': 'in_progress'}
            container.start()
            self._operation_states[container_name] = {'action': 'start', 'status': 'completed'}
            del self._operation_states[container_name]
        except Exception as e:
            logger.error(f"Error starting container {container_name}: {str(e)}")  # Added error log
            self._operation_states[container_name] = {'action': 'start', 'status': 'error', 'error': str(e)}
            del self._operation_states[container_name]
            raise

    async def stop_container(self, container_name: str):
        """Stop a container and track its operation state"""
        try:
            container = self.client.containers.get(container_name)
            self._operation_states[container_name] = {'action': 'stop', 'status': 'in_progress'}
            container.stop()
            self._operation_states[container_name] = {'action': 'stop', 'status': 'completed'}
            del self._operation_states[container_name]
        except Exception as e:
            logger.error(f"Error stopping container {container_name}: {str(e)}")  # Added error log
            self._operation_states[container_name] = {'action': 'stop', 'status': 'error', 'error': str(e)}
            del self._operation_states[container_name]
            raise
