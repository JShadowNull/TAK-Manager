import os
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
import time
from typing import Dict, Any, Optional, Callable, Coroutine
import logging
from backend.config.logging_config import configure_logging
import asyncio
import docker
from backend.services.helpers.directories import DirectoryHelper

# Setup logging
logger = configure_logging(__name__)

class TakServerStatus:
    def __init__(self, emit_event: Optional[Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]] = None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.emit_event = emit_event
        self.docker_client = docker.from_env()

    async def update_status(self, operation: str, status: str, message: str, error: Optional[str] = None) -> Dict[str, Any]:
        """Update operation status."""
        status_data = {
            "operation": operation,
            "status": status,
            "message": message,
            "error": error,
            "timestamp": int(time.time() * 1000)
        }
        if self.emit_event:
            await self.emit_event(status_data)
        return status_data

    def check_installation(self):
        """Check if TAK Server is installed."""
        docker_compose_path = self.directory_helper.get_docker_compose_directory()
        
        if not os.path.exists(docker_compose_path):
            logger.debug("docker-compose.yml not found")
            return False

        return True

    async def check_containers_running(self):
        """Check if TAK Server containers are running."""
        if not self.check_installation():
            return False

        version = self.directory_helper.get_takserver_version()
        if not version:
            return False

        try:
            containers = [
                f"takserver-{version}",
                f"tak-database-{version}"
            ]

            for container_name in containers:
                try:
                    container = self.docker_client.containers.get(container_name)
                    container_status = container.status
                    
                    if container_status != "running":
                        return False
                except docker.errors.NotFound:
                    return False
                except Exception as e:
                    logger.error(f"Error inspecting container {container_name}: {str(e)}")
                    return False

            return True

        except Exception as e:
            logger.error(f"Error checking container status: {str(e)}")
            return False

    async def get_status(self) -> Dict[str, Any]:
        """Get TAK Server installation and running state."""
        is_installed = self.check_installation()
        version = self.directory_helper.get_takserver_version() if is_installed else None
        is_running = await self.check_containers_running() if is_installed else False
        
        status = {
            "isInstalled": is_installed,
            "isRunning": is_running,
            "version": version if version else "Not Installed"
        }
        return status

    async def start_containers(self) -> Dict[str, Any]:
        """Start TAK Server containers."""
        try:
            logger.debug("Starting TAK Server containers...")
            if not self.check_installation():
                logger.debug("TAK Server is not installed, cannot start containers")
                return await self.update_status("start", "error", "TAK Server is not installed")

            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            logger.debug(f"Using docker compose directory: {docker_compose_dir}")
            await self.update_status("start", "in_progress", "Starting TAK Server containers...")
            
            logger.debug("Running docker-compose up command...")
            result = await self.run_command.run_command_async(
                ["docker-compose", "up", "-d"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be running
            logger.debug("Waiting for containers to start...")
            for attempt in range(30):  # 30 attempts, 2 seconds each
                logger.debug(f"Checking container status - attempt {attempt + 1}/30")
                if await self.check_containers_running():
                    logger.debug("Containers started successfully")
                    return await self.update_status(
                        "start",
                        "complete",
                        "TAK Server containers started successfully"
                    )
                await asyncio.sleep(2)

            logger.debug("Timeout waiting for containers to start")
            return await self.update_status(
                "start",
                "error",
                "Timeout waiting for containers to start"
            )

        except Exception as e:
            logger.error(f"Error starting containers: {str(e)}")
            return await self.update_status(
                "start",
                "error",
                "Error starting TAK Server containers",
                str(e)
            )

    async def stop_containers(self) -> Dict[str, Any]:
        """Stop TAK Server containers."""
        try:
            logger.debug("Stopping TAK Server containers...")
            if not self.check_installation():
                logger.debug("TAK Server is not installed, cannot stop containers")
                return await self.update_status("stop", "error", "TAK Server is not installed")

            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            logger.debug(f"Using docker compose directory: {docker_compose_dir}")
            await self.update_status("stop", "in_progress", "Stopping TAK Server containers...")
            
            logger.debug("Running docker-compose down command...")
            result = await self.run_command.run_command_async(
                ["docker-compose", "down"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be stopped
            logger.debug("Waiting for containers to stop...")
            for attempt in range(30):  # 30 attempts, 2 seconds each
                logger.debug(f"Checking container status - attempt {attempt + 1}/30")
                if not await self.check_containers_running():
                    logger.debug("Containers stopped successfully")
                    return await self.update_status(
                        "stop",
                        "complete",
                        "TAK Server containers stopped successfully"
                    )
                await asyncio.sleep(2)

            logger.debug("Timeout waiting for containers to stop")
            return await self.update_status(
                "stop",
                "error",
                "Timeout waiting for containers to stop"
            )

        except Exception as e:
            logger.error(f"Error stopping containers: {str(e)}")
            return await self.update_status(
                "stop",
                "error",
                "Error stopping TAK Server containers",
                str(e)
            )

    async def restart_containers(self) -> Dict[str, Any]:
        """Restart TAK Server containers."""
        try:
            logger.debug("Restarting TAK Server containers...")
            if not self.check_installation():
                logger.debug("TAK Server is not installed, cannot restart containers")
                return await self.update_status("restart", "error", "TAK Server is not installed")

            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            logger.debug(f"Using docker compose directory: {docker_compose_dir}")
            await self.update_status("restart", "in_progress", "Restarting TAK Server containers...")
            
            logger.debug("Running docker-compose restart command...")
            result = await self.run_command.run_command_async(
                ["docker-compose", "restart"],
                'status',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Wait for containers to be running
            logger.debug("Waiting for containers to restart...")
            for attempt in range(30):  # 30 attempts, 2 seconds each
                logger.debug(f"Checking container status - attempt {attempt + 1}/30")
                if await self.check_containers_running():
                    logger.debug("Containers restarted successfully")
                    return await self.update_status(
                        "restart",
                        "complete",
                        "TAK Server containers restarted successfully"
                    )
                await asyncio.sleep(2)

            logger.debug("Timeout waiting for containers to restart")
            return await self.update_status(
                "restart",
                "error",
                "Timeout waiting for containers to restart"
            )

        except Exception as e:
            logger.error(f"Error restarting containers: {str(e)}")
            return await self.update_status(
                "restart",
                "error",
                "Error restarting TAK Server containers",
                str(e)
            )
