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
import json
from backend.services.scripts.docker.docker_manager import DockerManager
# Setup logging
logger = configure_logging(__name__)

logger.setLevel(logging.ERROR)

class TakServerStatus:
    def __init__(self, emit_event=None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.emit_event = emit_event
        self.docker_client = docker.from_env()

    async def emit_operation_status(self, status: str, message: str, error: Optional[str] = None):
        if self.emit_event:
            await self.emit_event({
                "type": "operation",
                "status": status,
                "message": message,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })

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
            logger.error("Installation check failed.")
            return False

        version = self.directory_helper.get_takserver_version()
        if not version:
            logger.error("TAK Server version not found.")
            return False

        try:
            docker_manager = DockerManager()
            container_status = docker_manager.get_container_status()
            
            required_containers = {
                f"takserver-{version}": False,
                f"tak-database-{version}": False
            }

            for container in container_status['containers']:
                if container['name'] in required_containers:
                    required_containers[container['name']] = container['running']

            # Check if all required containers exist and are running
            all_running = all(required_containers.values())
            if not all_running:
                not_running = [name for name, running in required_containers.items() if not running]
                logger.debug(f"The following containers are not running or missing: {', '.join(not_running)}")
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking container status: {str(e)}")
            return False

    async def get_status(self) -> Dict[str, Any]:
        try:
            logger.debug("Getting status of TAK Server...")
            version = None
            version_file = self.directory_helper.get_version_file_path()
            
            if os.path.exists(version_file):
                with open(version_file, 'r') as f:
                    version = f.read().strip()
                    logger.debug(f"Found version: {version}")

            # If no version file exists, return not installed status
            if not version:
                logger.debug("No version found, returning not installed status.")
                return {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": None
                }

            if not self.check_installation():
                logger.debug("Installation check failed, returning not installed status.")
                return {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": None
                }

            is_running = await self.check_containers_running()
            logger.debug(f"Containers running status: {is_running}")

            return {
                "isInstalled": True,
                "isRunning": is_running,
                "version": version
            }

        except Exception as e:
            logger.error(f"Error checking status: {str(e)}")
            return {
                "isInstalled": False,
                "isRunning": False,
                "version": None
            }

    async def start_containers(self) -> Dict[str, Any]:
        try:
            await self.emit_operation_status("in_progress", "Starting TAK Server containers...")
            
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker-compose", "up", "-d"],
                'operation',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            
            if not result.success:
                await self.emit_operation_status("error", "Failed to start containers", result.stderr)
                return {"status": "error", "message": result.stderr}
            
            await self.emit_operation_status("complete", "TAK Server containers started successfully")
            return {"status": "success", "message": "Containers started"}
            
        except Exception as e:
            await self.emit_operation_status("error", "Error starting containers", str(e))
            return {"status": "error", "message": str(e)}

    async def stop_containers(self) -> Dict[str, Any]:
        try:
            await self.emit_operation_status("in_progress", "Stopping TAK Server containers...")
            
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker-compose", "down"],
                'operation',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            
            if not result.success:
                await self.emit_operation_status("error", "Failed to stop containers", result.stderr)
                return {"status": "error", "message": result.stderr}
            
            await self.emit_operation_status("complete", "TAK Server containers stopped successfully")
            return {"status": "success", "message": "Containers stopped"}
            
        except Exception as e:
            await self.emit_operation_status("error", "Error stopping containers", str(e))
            return {"status": "error", "message": str(e)}

    async def restart_containers(self) -> Dict[str, Any]:
        try:
            await self.emit_operation_status("in_progress", "Restarting TAK Server containers...")
            
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker-compose", "restart"],
                'operation',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            
            if not result.success:
                await self.emit_operation_status("error", "Failed to restart containers", result.stderr)
                return {"status": "error", "message": result.stderr}
            
            await self.emit_operation_status("complete", "TAK Server containers restarted successfully")
            return {"status": "success", "message": "Containers restarted"}
            
        except Exception as e:
            await self.emit_operation_status("error", "Error restarting containers", str(e))
            return {"status": "error", "message": str(e)}
