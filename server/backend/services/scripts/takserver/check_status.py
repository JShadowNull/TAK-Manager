import os
from pathlib import Path
from backend.services.helpers.os_detector import OSDetector
from backend.services.helpers.run_command import RunCommand
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.docker.docker_checker import DockerChecker
from backend.routes.socketio import socketio
from backend.services.helpers.operation_status import OperationStatus
import eventlet

class TakServerStatus:
    def __init__(self):
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.docker_checker = DockerChecker()
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()
        self.operation_status = OperationStatus('/takserver-status')

    def _emit_status(self, is_running, error=None):
        """Helper method to emit consistent status updates."""
        status = {
            'isInstalled': True,
            'isRunning': is_running,
            'dockerRunning': True,
            'version': self.get_takserver_version(),
            'error': error,
            'isUninstalling': False
        }
        socketio.emit('takserver_status', status, namespace='/takserver-status')

    def get_default_working_directory(self):
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type == 'windows' or os_type == 'macos':
            documents_dir = os.path.join(home_dir, 'Documents')
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            working_dir = os.path.join(home_dir, 'takserver-docker')
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
        """Get complete TAK Server status."""
        # First check if Docker is running using DockerChecker
        docker_status = self.docker_checker.get_status()
        if not docker_status['isRunning']:
            return {
                'isInstalled': False,
                'isRunning': False,
                'dockerRunning': False,
                'version': None,
                'error': docker_status.get('error', 'Docker is not running'),
                'isStarting': False,
                'isStopping': False,
                'isRestarting': False,
                'isUninstalling': False
            }

        is_installed = self.check_installation()
        is_running = self.check_containers_running() if is_installed else False
        version = self.get_takserver_version() if is_installed else None

        status = {
            'isInstalled': is_installed,
            'isRunning': is_running,
            'dockerRunning': True,
            'version': version,
            'error': None,
            'isStarting': False,
            'isStopping': False,
            'isRestarting': False,
            'isUninstalling': False
        }

        return status

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        return os.path.join(self.working_dir, f"takserver-docker-{version}")

    def wait_for_containers_state(self, desired_state, timeout=60, interval=2):
        """
        Wait for containers to reach desired state (running or stopped)
        Args:
            desired_state (bool): True for running, False for stopped
            timeout (int): Maximum time to wait in seconds
            interval (int): Time between checks in seconds
        Returns:
            bool: True if desired state reached, False if timeout
        """
        import time
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            current_state = self.check_containers_running()
            if current_state == desired_state:
                return True
            
            self.run_command.emit_log_output(
                f"Waiting for containers to be {'running' if desired_state else 'stopped'}...", 
                'takserver-status'
            )
            eventlet.sleep(interval)
        
        return False

    def start_containers(self):
        """Start TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_status.start_operation('start', "Starting TAK Server containers...")
            self._emit_status(False)
            
            self.run_command.emit_log_output(
                "Starting TAK Server containers...", 
                'takserver-status'
            )
            
            result = self.run_command.run_command(
                ["docker-compose", "up", "-d"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            if not self.wait_for_containers_state(True):
                raise Exception("Timeout waiting for containers to start")

            self.operation_status.complete_operation('start', "TAK Server containers started successfully")
            self._emit_status(True)

            self.run_command.emit_log_output(
                "TAK Server containers started successfully", 
                'takserver-status'
            )
            return True

        except Exception as e:
            self.operation_status.fail_operation('start', str(e))
            self._emit_status(False, str(e))
            
            self.run_command.emit_log_output(
                f"Error starting TAK Server: {str(e)}", 
                'takserver-status'
            )
            return False

    def stop_containers(self):
        """Stop TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_status.start_operation('stop', "Stopping TAK Server containers...")
            self._emit_status(True)
            
            self.run_command.emit_log_output(
                "Stopping TAK Server containers...", 
                'takserver-status'
            )
            
            result = self.run_command.run_command(
                ["docker-compose", "down"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            if not self.wait_for_containers_state(False):
                raise Exception("Timeout waiting for containers to stop")

            self.operation_status.complete_operation('stop', "TAK Server containers stopped successfully")
            self._emit_status(False)

            self.run_command.emit_log_output(
                "TAK Server containers stopped successfully", 
                'takserver-status'
            )
            return True

        except Exception as e:
            self.operation_status.fail_operation('stop', str(e))
            self._emit_status(True, str(e))
            
            self.run_command.emit_log_output(
                f"Error stopping TAK Server: {str(e)}", 
                'takserver-status'
            )
            return False

    def restart_containers(self):
        """Restart TAK Server containers using docker-compose"""
        try:
            if not self.check_installation():
                raise Exception("TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            
            self.operation_status.start_operation('restart', "Restarting TAK Server containers...")
            self._emit_status(True)
            
            self.run_command.emit_log_output(
                "Restarting TAK Server containers...", 
                'takserver-status'
            )
            
            result = self.run_command.run_command(
                ["docker-compose", "restart"],
                working_dir=docker_compose_dir,
                namespace='takserver-status',
                capture_output=True
            )

            if not self.wait_for_containers_state(True):
                raise Exception("Timeout waiting for containers to restart")

            self.operation_status.complete_operation('restart', "TAK Server containers restarted successfully")
            self._emit_status(True)

            self.run_command.emit_log_output(
                "TAK Server containers restarted successfully", 
                'takserver-status'
            )
            return True

        except Exception as e:
            self.operation_status.fail_operation('restart', str(e))
            self._emit_status(False, str(e))
            
            self.run_command.emit_log_output(
                f"Error restarting TAK Server: {str(e)}", 
                'takserver-status'
            )
            return False