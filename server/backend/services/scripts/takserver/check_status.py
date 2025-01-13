import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
import time
from typing import Dict, Any, Optional, Callable
import logging
from backend.config.logging_config import configure_logging
import asyncio
import docker

# Setup logging
logger = configure_logging(__name__)
logger.setLevel(logging.INFO)

class TakServerStatus:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.working_dir = self.get_default_working_directory()
        self.emit_event = emit_event
        self.docker_client = docker.from_env()

    def update_status(self, operation: str, status: str, message: str, error: Optional[str] = None) -> Dict[str, Any]:
        """Update operation status."""
        status_data = {
            "type": "status",
            "operation": operation,
            "status": status,
            "message": message,
            "error": error,
            "isError": error is not None,
            "timestamp": int(time.time() * 1000)
        }
        if self.emit_event:
            self.emit_event(status_data)
        return status_data

    def get_default_working_directory(self):
        """Get the working directory."""
        base_dir = '/home/tak-manager'
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def get_docker_compose_dir(self):
        """Get the docker compose directory."""
        version = self.get_takserver_version()
        if not version:
            raise Exception("Could not determine TAK Server version")
        path_version = self._get_path_version(version)
        return os.path.join(self.working_dir, f"takserver-docker-{path_version}")

    def get_takserver_version(self):
        """Get TAK Server version from version.txt."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    if not version:
                        return None
                    return version
            except Exception:
                return None
        return None

    def _get_path_version(self, version):
        """Convert version string for path use."""
        if not version:
            return None
        parts = version.split('-')
        if len(parts) >= 3:
            return f"{parts[0]}-RELEASE-{parts[2]}"
        return version

    def check_installation(self):
        """Check if TAK Server is installed."""
        logger.debug("Checking TAK Server installation...")
        
        if not os.path.exists(self.working_dir):
            logger.debug(f"Working directory does not exist: {self.working_dir}")
            return False

        version = self.get_takserver_version()
        if not version:
            logger.debug("Could not determine TAK Server version")
            return False

        path_version = self._get_path_version(version)
        docker_compose_path = os.path.join(self.working_dir, f"takserver-docker-{path_version}", "docker-compose.yml")
        logger.debug(f"Checking for docker-compose.yml at: {docker_compose_path}")
        
        if not os.path.exists(docker_compose_path):
            logger.debug("docker-compose.yml not found")
            return False

        logger.debug("TAK Server installation check passed")
        return True

    async def check_containers_running(self):
        """Check if TAK Server containers are running."""
        logger.debug("Checking if TAK Server containers are running...")
        
        if not self.check_installation():
            logger.debug("TAK Server installation check failed")
            return False

        version = self.get_takserver_version()
        if not version:
            logger.debug("Could not determine TAK Server version")
            return False

        try:
            containers = [
                f"takserver-{version}",
                f"tak-database-{version}"
            ]
            logger.debug(f"Checking containers: {containers}")

            for container_name in containers:
                logger.debug(f"Inspecting container: {container_name}")
                try:
                    container = self.docker_client.containers.get(container_name)
                    container_status = container.status
                    logger.debug(f"Container {container_name} status: {container_status}")
                    
                    if container_status != "running":
                        logger.debug(f"Container {container_name} is not running")
                        return False
                except docker.errors.NotFound:
                    logger.debug(f"Container {container_name} not found")
                    return False
                except Exception as e:
                    logger.error(f"Error inspecting container {container_name}: {str(e)}")
                    return False

            logger.debug("All containers are running")
            return True

        except Exception as e:
            logger.error(f"Error checking container status: {str(e)}")
            return False

    async def get_status(self) -> Dict[str, Any]:
        """Get TAK Server installation and running state."""
        logger.debug("Getting TAK Server status...")
        
        is_installed = self.check_installation()
        logger.debug(f"Installation status: {is_installed}")
        
        version = self.get_takserver_version() if is_installed else None
        logger.debug(f"Version: {version}")
        
        is_running = await self.check_containers_running() if is_installed else False
        logger.debug(f"Running status: {is_running}")
        
        status = {
            "isInstalled": is_installed,
            "isRunning": is_running,
            "version": self._get_path_version(version) if version else "Not Installed"
        }
        logger.debug(f"Final status: {status}")
        return status

    async def start_containers(self) -> Dict[str, Any]:
        """Start TAK Server containers."""
        try:
            if not self.check_installation():
                return self.update_status("start", "error", "TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            self.update_status("start", "in_progress", "Starting TAK Server containers...")
            
            result = await self.run_command.run_command_async(
                ["docker-compose", "up", "-d"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if await self.check_containers_running():
                    return self.update_status(
                        "start",
                        "complete",
                        "TAK Server containers started successfully"
                    )
                await asyncio.sleep(2)

            return self.update_status(
                "start",
                "error",
                "Timeout waiting for containers to start"
            )

        except Exception as e:
            return self.update_status(
                "start",
                "error",
                "Error starting TAK Server containers",
                str(e)
            )

    async def stop_containers(self) -> Dict[str, Any]:
        """Stop TAK Server containers."""
        try:
            if not self.check_installation():
                return self.update_status("stop", "error", "TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            self.update_status("stop", "in_progress", "Stopping TAK Server containers...")
            
            result = await self.run_command.run_command_async(
                ["docker-compose", "down"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be stopped
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if not await self.check_containers_running():
                    return self.update_status(
                        "stop",
                        "complete",
                        "TAK Server containers stopped successfully"
                    )
                await asyncio.sleep(2)

            return self.update_status(
                "stop",
                "error",
                "Timeout waiting for containers to stop"
            )

        except Exception as e:
            return self.update_status(
                "stop",
                "error",
                "Error stopping TAK Server containers",
                str(e)
            )

    async def restart_containers(self) -> Dict[str, Any]:
        """Restart TAK Server containers."""
        try:
            if not self.check_installation():
                return self.update_status("restart", "error", "TAK Server is not installed")

            docker_compose_dir = self.get_docker_compose_dir()
            self.update_status("restart", "in_progress", "Restarting TAK Server containers...")
            
            result = await self.run_command.run_command_async(
                ["docker-compose", "restart"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be running
            for attempt in range(30):  # 30 attempts, 2 seconds each
                if await self.check_containers_running():
                    return self.update_status(
                        "restart",
                        "complete",
                        "TAK Server containers restarted successfully"
                    )
                await asyncio.sleep(2)

            return self.update_status(
                "restart",
                "error",
                "Timeout waiting for containers to restart"
            )

        except Exception as e:
            return self.update_status(
                "restart",
                "error",
                "Error restarting TAK Server containers",
                str(e)
            )