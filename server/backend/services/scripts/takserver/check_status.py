import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
import time
from backend.config.logging_config import configure_logging
from flask_sse import sse

# Setup basic logging
logger = configure_logging(__name__)

class TakServerStatus:
    def __init__(self):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        path_version = self._get_path_version(version)
        return os.path.join(self.working_dir, f"takserver-docker-{path_version}")

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    if not version:
                        return None
                    # Keep version string as is, no case conversion
                    return version
            except Exception as e:
                return None
        else:
            return None

    def _get_path_version(self, version):
        """Convert version string for path use (with RELEASE in uppercase)."""
        if not version:
            return None
        parts = version.split('-')
        if len(parts) >= 3:
            return f"{parts[0]}-RELEASE-{parts[2]}"
        return version

    def check_installation(self):
        """Check if TAK Server is installed."""
        # Check if working directory exists
        if not os.path.exists(self.working_dir):
            return False

        # Check if version.txt exists
        version = self.get_takserver_version()
        if not version:
            return False

        # Check if docker-compose.yml exists in the correct location
        path_version = self._get_path_version(version)
        docker_compose_path = os.path.join(self.working_dir, f"takserver-docker-{path_version}", "docker-compose.yml")
        if not os.path.exists(docker_compose_path):
            return False

        return True

    def check_containers_running(self):
        """Check if TAK Server containers are running."""
        if not self.check_installation():
            return False

        version = self.get_takserver_version()
        if not version:
            return False

        try:
            # Check if both containers are running
            containers = [
                f"takserver-{version}",
                f"tak-database-{version}"
            ]

            for container in containers:
                result = self.run_command.run_command(
                    ["docker", "container", "inspect", "-f", "{{.State.Running}}", container],
                    event_type='takserver-status',
                    capture_output=True,
                    emit_output=False
                )
                
                if not result.success:
                    return False
                    
                # Check the actual output, removing any whitespace and converting to lowercase
                container_status = result.stdout.strip().lower()
                if container_status != "true":
                    return False

            return True

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error checking container status: {str(e)}",
                'takserver-status',
                error=True
            )
            return False
            
    def get_status(self):
        """Get TAK Server status - first checks if installed, then running state if installed."""

        is_installed = self.check_installation()
        if not is_installed:
            sse.publish({
                "isInstalled": False,
                "isRunning": False,
                "version": "Not Installed"
            }, type='takserver-status')
            return

        is_running = self.check_containers_running()
        version = self.get_takserver_version()
        formatted_version = self._get_path_version(version) if version else "Not Installed"
        sse.publish({
            "isInstalled": True,
            "isRunning": is_running,
            "version": formatted_version
        }, type='takserver-status')

    def start_containers(self):
        """Start TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            # Send start operation status
            sse.publish({
                'status': 'in_progress',
                'operation': 'start',
                'message': 'Starting TAK Server containers...',
                'details': {'docker_compose_dir': docker_compose_dir},
                'timestamp': time.time()
            }, type='takserver-status')
            
            result = self.run_command.run_command(
                ["docker-compose", "up", "-d"],
                event_type='takserver-status',
                working_dir=docker_compose_dir,
                capture_output=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if self.check_containers_running():
                    # Send success status
                    sse.publish({
                        'status': 'completed',
                        'operation': 'start',
                        'message': 'TAK Server containers started successfully',
                        'details': {'docker_compose_dir': docker_compose_dir},
                        'timestamp': time.time()
                    }, type='takserver-status')
                    return True
                time.sleep(2)

            raise Exception("Timeout waiting for containers to start")

        except Exception as e:
            # Send error status
            sse.publish({
                'status': 'error', 
                'operation': 'start',
                'message': f'Error starting TAK Server containers: {str(e)}',
                'details': {'error': str(e)},
                'timestamp': time.time()
            }, type='takserver-status')
            return False

    def stop_containers(self):
        """Stop TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            # Send stop operation status
            sse.publish({
                'status': 'in_progress',
                'operation': 'stop', 
                'message': 'Stopping TAK Server containers...',
                'details': {'docker_compose_dir': docker_compose_dir},
                'timestamp': time.time()
            }, type='takserver-status')
            
            result = self.run_command.run_command(
                ["docker-compose", "down"],
                event_type='takserver-status',
                working_dir=docker_compose_dir,
                capture_output=True
            )

            # Wait for containers to be stopped
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if not self.check_containers_running():
                    # Send success status
                    sse.publish({
                        'status': 'completed',
                        'operation': 'stop',
                        'message': 'TAK Server containers stopped successfully',
                        'details': {'docker_compose_dir': docker_compose_dir},
                        'timestamp': time.time()
                    }, type='takserver-status')
                    return True
                time.sleep(2)

            raise Exception("Timeout waiting for containers to stop")

        except Exception as e:
            # Send error status
            sse.publish({
                'status': 'error',
                'operation': 'stop',
                'message': f'Error stopping TAK Server containers: {str(e)}',
                'details': {'error': str(e)},
                'timestamp': time.time()
            }, type='takserver-status')
            return False

    def restart_containers(self):
        """Restart TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            # Send restart operation status
            sse.publish({
                'status': 'in_progress',
                'operation': 'restart',
                'message': 'Restarting TAK Server containers...',
                'details': {'docker_compose_dir': docker_compose_dir},
                'timestamp': time.time()
            }, type='takserver-status')
            
            result = self.run_command.run_command(
                ["docker-compose", "restart"],
                event_type='takserver-status',
                working_dir=docker_compose_dir,
                capture_output=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if self.check_containers_running():
                    # Send success status
                    sse.publish({
                        'status': 'completed',
                        'operation': 'restart',
                        'message': 'TAK Server containers restarted successfully',
                        'details': {'docker_compose_dir': docker_compose_dir},
                        'timestamp': time.time()
                    }, type='takserver-status')
                    return True
                time.sleep(2)

            raise Exception("Timeout waiting for containers to restart")

        except Exception as e:
            # Send error status
            sse.publish({
                'status': 'error',
                'operation': 'restart', 
                'message': f'Error restarting TAK Server containers: {str(e)}',
                'details': {'error': str(e)},
                'timestamp': time.time()
            }, type='takserver-status')
            return False