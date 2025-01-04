import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
import eventlet
import logging

# Get the logger and ensure it's activated in the logging system
# This module-level log is necessary because this module is loaded once at startup
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

class TakServerStatus:
    def __init__(self):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self.current_operation = None
        self.operation_progress = 0
        logger.info(f"[TakServerStatus] Initialized with working directory: {self.working_dir}")

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
            logger.info(f"[TakServerStatus] Created working directory: {working_dir}")
        else:
            logger.info(f"[TakServerStatus] Using existing working directory: {working_dir}")
        return working_dir

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        logger.info(f"[TakServerStatus] Checking for version file at: {version_file_path}")
        
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    logger.info(f"[TakServerStatus] Found TAK Server version: '{version}'")
                    if not version:
                        logger.error("[TakServerStatus] Version file exists but is empty")
                        return None
                    # Keep version string as is, no case conversion
                    return version
            except Exception as e:
                logger.error(f"[TakServerStatus] Error reading version file: {str(e)}")
                return None
        else:
            logger.warning(f"[TakServerStatus] Version file not found at: {version_file_path}")
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
            logger.warning("[TakServerStatus] Working directory does not exist")
            return False

        # Check if version.txt exists
        version = self.get_takserver_version()
        if not version:
            logger.warning("[TakServerStatus] Could not determine TAK Server version")
            return False

        # Check if docker-compose.yml exists in the correct location
        path_version = self._get_path_version(version)
        docker_compose_path = os.path.join(self.working_dir, f"takserver-docker-{path_version}", "docker-compose.yml")
        logger.info(f"[TakServerStatus] Checking for docker-compose.yml at: {docker_compose_path}")
        if not os.path.exists(docker_compose_path):
            logger.warning(f"[TakServerStatus] docker-compose.yml not found at: {docker_compose_path}")
            return False

        logger.info("[TakServerStatus] Installation check passed")
        return True

    def check_containers_running(self):
        """Check if TAK Server containers are running."""
        if not self.check_installation():
            logger.warning("[TakServerStatus] Cannot check containers - TAK Server not installed")
            return False

        version = self.get_takserver_version()
        if not version:
            logger.warning("[TakServerStatus] Cannot check containers - Version not found")
            return False

        try:
            # Check if both containers are running
            containers = [
                f"takserver-{version}",
                f"tak-database-{version}"
            ]

            logger.info(f"[TakServerStatus] Checking status of containers: {containers}")
            for container in containers:
                result = self.run_command.run_command(
                    ["docker", "container", "inspect", "-f", "{{.State.Running}}", container],
                    namespace='takserver-status',
                    capture_output=True,
                    emit_output=False
                )
                
                if result.stdout.strip().lower() != "true":
                    logger.warning(f"[TakServerStatus] Container {container} is not running")
                    return False

            logger.info("[TakServerStatus] All containers are running")
            return True

        except Exception as e:
            logger.error(f"[TakServerStatus] Error checking container status: {str(e)}")
            return False

    def get_status(self):
        """Get TAK Server status - first checks if installed, then running state if installed."""
        logger.info("[TakServerStatus] Checking TAK Server status")
        is_installed = self.check_installation()
        if not is_installed:
            logger.warning("[TakServerStatus] TAK Server is not installed")
            return {
                'isInstalled': False,
                'isRunning': False
            }

        is_running = self.check_containers_running()
        logger.info(f"[TakServerStatus] Status check complete - Installed: {is_installed}, Running: {is_running}")
        return {
            'isInstalled': True,
            'isRunning': is_running
        }

    def get_docker_compose_dir(self):
        """Get the docker compose directory based on version"""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        path_version = self._get_path_version(version)
        return os.path.join(self.working_dir, f"takserver-docker-{path_version}")

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