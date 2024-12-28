# backend/services/scripts/docker_manager.py

import docker
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.operation_status import OperationStatus


class DockerManager:
    def __init__(self):
        self.os_detector = OSDetector()
        self.os_type = self.os_detector.detect_os()
        self.status_helper = None  # Will be set when socketio is available
        self.client = docker.from_env()

    def initialize_status_helper(self, socketio):
        """Initialize the status helper with socketio instance"""
        self.status_helper = OperationStatus(socketio=socketio, namespace='/docker-manager')

    def start_container(self, container_name):
        """Start a Docker container by its name."""
        try:
            if not self.status_helper:
                return {"error": "Status helper not initialized"}

            # Start operation with container details
            self.status_helper.start_operation(
                'start',
                f"Starting container {container_name}...",
                details={'container': container_name}
            )

            container = self.client.containers.get(container_name)
            container.start()
            
            success_msg = f"Container {container_name} started successfully."
            self.status_helper.complete_operation(
                'start',
                success_msg,
                details={'container': container_name}
            )
            return {"status": success_msg}
            
        except docker.errors.NotFound:
            error = f"Container {container_name} not found"
            if self.status_helper:
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
            return {"error": error}
        except docker.errors.APIError as e:
            error = f"Error starting container {container_name}: {str(e)}"
            if self.status_helper:
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
            return {"error": error}
        except Exception as e:
            error = f"Unexpected error starting container: {str(e)}"
            if self.status_helper:
                self.status_helper.fail_operation(
                    'start',
                    error,
                    details={'container': container_name}
                )
            return {"error": error}

    def stop_container(self, container_name):
        """Stop a Docker container by its name."""
        try:
            # Start operation with container details
            self.status_helper.start_operation(
                'stop',
                f"Stopping container {container_name}...",
                details={'container': container_name}
            )

            container = self.client.containers.get(container_name)
            container.stop()
            
            success_msg = f"Container {container_name} stopped successfully."
            self.status_helper.complete_operation(
                'stop',
                success_msg,
                details={'container': container_name}
            )
            return {"status": success_msg}
            
        except docker.errors.NotFound:
            error = f"Container {container_name} not found"
            self.status_helper.fail_operation(
                'stop',
                error,
                details={'container': container_name}
            )
            return {"error": error}
        except docker.errors.APIError as e:
            error = f"Error stopping container {container_name}: {str(e)}"
            self.status_helper.fail_operation(
                'stop',
                error,
                details={'container': container_name}
            )
            return {"error": error}

    def list_containers(self):
        """List Docker containers (running and non-running) with their status."""
        try:
            containers = self.client.containers.list(all=True)
            container_list = []
            for container in containers:
                container_list.append({
                    "name": container.name,
                    "status": container.status
                })
            return container_list
        except docker.errors.APIError as e:
            print(f"Error listing containers: {str(e)}")
            return []

