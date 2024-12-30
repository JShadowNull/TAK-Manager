import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from backend.services.helpers.operation_status import OperationStatus
import eventlet

class TakServerStatus:
    def __init__(self):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self.operation_status = OperationStatus('/takserver-status')
        self.current_operation = None
        self.operation_progress = 0

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        if os.path.exists(version_file_path):
            with open(version_file_path, "r") as version_file:
                return version_file.read().strip()
        return None

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
        docker_compose_path = os.path.join(self.working_dir, f"takserver-docker-{version}", "docker-compose.yml")
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
                    namespace='takserver-status',
                    capture_output=True,
                    emit_output=False
                )
                
                if result.stdout.strip().lower() != "true":
                    return False

            return True

        except Exception as e:
            self.run_command.emit_log_output(
                f"Error checking container status: {str(e)}", 
                'takserver-status'
            )
            return False

    def get_status(self):
        """Get TAK Server status - first checks if installed, then running state if installed."""
        is_installed = self.check_installation()
        if not is_installed:
            return {
                'isInstalled': False,
                'isRunning': False
            }

        is_running = self.check_containers_running()
        return {
            'isInstalled': True,
            'isRunning': is_running
        }

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return os.path.join(self.working_dir, f"takserver-docker-{version}")

    def get_operation_progress(self):
        """Get current operation progress"""
        if not self.current_operation:
            return {
                'operation': None,
                'progress': 0,
                'status': 'idle'
            }
        return {
            'operation': self.current_operation,
            'progress': self.operation_progress,
            'status': 'in_progress' if self.operation_progress < 100 else 'complete'
        }

    def start_containers(self):
        """Start TAK Server containers using docker-compose"""
        try:
            self.current_operation = 'start'
            self.operation_progress = 0

            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_progress = 20
            result = self.run_command.run_command(
                ["docker-compose", "up", "-d"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                self.operation_progress = 20 + int((attempt + 1) * 2.6)  # Progress from 20 to 98
                if self.check_containers_running():
                    self.operation_progress = 100
                    return True
                eventlet.sleep(2)

            raise Exception("Timeout waiting for containers to start")

        except Exception as e:
            self.run_command.emit_log_output(str(e), 'takserver-status')
            return False
        finally:
            self.current_operation = None
            self.operation_progress = 0

    def stop_containers(self):
        """Stop TAK Server containers using docker-compose"""
        try:
            self.current_operation = 'stop'
            self.operation_progress = 0

            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_progress = 20
            result = self.run_command.run_command(
                ["docker-compose", "down"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            # Wait for containers to be stopped
            for attempt in range(30):  # 30 attempts, 2 seconds each
                self.operation_progress = 20 + int((attempt + 1) * 2.6)  # Progress from 20 to 98
                if not self.check_containers_running():
                    self.operation_progress = 100
                    return True
                eventlet.sleep(2)

            raise Exception("Timeout waiting for containers to stop")

        except Exception as e:
            self.run_command.emit_log_output(str(e), 'takserver-status')
            return False
        finally:
            self.current_operation = None
            self.operation_progress = 0

    def restart_containers(self):
        """Restart TAK Server containers using docker-compose"""
        try:
            self.current_operation = 'restart'
            self.operation_progress = 0

            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_progress = 20
            result = self.run_command.run_command(
                ["docker-compose", "restart"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                self.operation_progress = 20 + int((attempt + 1) * 2.6)  # Progress from 20 to 98
                if self.check_containers_running():
                    self.operation_progress = 100
                    return True
                eventlet.sleep(2)

            raise Exception("Timeout waiting for containers to restart")

        except Exception as e:
            self.run_command.emit_log_output(str(e), 'takserver-status')
            return False
        finally:
            self.current_operation = None
            self.operation_progress = 0