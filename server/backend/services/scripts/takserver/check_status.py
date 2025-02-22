import os
from backend.services.helpers.run_command import RunCommand
from typing import Dict, Any
from backend.config.logging_config import configure_logging
import docker
from backend.services.helpers.directories import DirectoryHelper
from backend.services.scripts.docker.docker_manager import DockerManager
import asyncio
import time

logger = configure_logging(__name__)

class TakServerStatus:
    def __init__(self, emit_event=None):
        """Initialize the TakServerStatus class.

        Args:
            emit_event (Optional[Callable[[Dict[str, Any]], None]]): A callback function to emit events.
        """
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.docker_client = docker.from_env()

    def check_installation(self):
        """Check if TAK Server is installed.

        Returns:
            bool: True if TAK Server is installed, False otherwise.
        """
        docker_compose_path = self.directory_helper.get_docker_compose_directory()
        
        if not os.path.exists(docker_compose_path):
            logger.debug("docker-compose.yml not found")
            return False

        return True

    async def check_containers_running(self):
        """Check if TAK Server containers are running.

        Returns:
            bool: True if all required containers are running, False otherwise.
        """
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
        """Get the current status of the TAK Server.

        Returns:
            Dict[str, Any]: A dictionary containing installation status, running status, and version.
        """
        try:
            version = None
            version_file = self.directory_helper.get_version_file_path()
            
            if os.path.exists(version_file):
                with open(version_file, 'r') as f:
                    version = f.read().strip()

            # If no version file exists, return not installed status
            if not version:
                return {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": None
                }

            if not self.check_installation():
                return {
                    "isInstalled": False,
                    "isRunning": False,
                    "version": None
                }

            is_running = await self.check_containers_running()

            return {
                "isInstalled": True,
                "isRunning": is_running,
                "version": version
            }

        except Exception as e:
            return {
                "isInstalled": False,
                "isRunning": False,
                "version": None
            }

    async def start_containers(self) -> Dict[str, Any]:
        """Start the TAK Server containers using Docker Compose.

        Returns:
            Dict[str, Any]: A dictionary indicating the status and message of the operation.
        """
        docker_compose_dir = self.directory_helper.get_docker_compose_directory()
        result = await self.run_command.run_command_async(
            ["docker", "compose", "up", "-d"],
            'operation',
            working_dir=docker_compose_dir,
            ignore_errors=True
        )
        
        if not result.success:
            logger.error(f"Failed to start containers: {result.stderr}")
            raise RuntimeError(f"Failed to start containers: {result.stderr}")
        
        logger.info("Containers started")
        return {"status": "success", "message": "Containers started"}

    async def stop_containers(self) -> Dict[str, Any]:
        """Stop the TAK Server containers using Docker Compose.

        Returns:
            Dict[str, Any]: A dictionary indicating the status and message of the operation.
        """
        docker_compose_dir = self.directory_helper.get_docker_compose_directory()
        result = await self.run_command.run_command_async(
            ["docker", "compose", "down"],
            'operation',
            working_dir=docker_compose_dir,
            ignore_errors=True
        )
        
        if not result.success:
            logger.error(f"Failed to stop containers: {result.stderr}")
            raise RuntimeError(f"Failed to stop containers: {result.stderr}")
        
        logger.info("Containers stopped")
        return {"status": "success", "message": "Containers stopped"}

    async def restart_containers(self) -> Dict[str, Any]:
        """Restart the TAK Server containers using Docker Compose.

        Returns:
            Dict[str, Any]: A dictionary indicating the status and message of the operation.
        """
        docker_compose_dir = self.directory_helper.get_docker_compose_directory()
        result = await self.run_command.run_command_async(
            ["docker", "compose", "restart"],
            'operation',
            working_dir=docker_compose_dir,
            ignore_errors=False
        )
        
        if not result.success:
            logger.error(f"Failed to restart containers: {result.stderr}")
            raise RuntimeError(f"Failed to restart containers: {result.stderr}")
        
        logger.info("Containers restarted")
        return {"status": "success", "message": "Containers restarted"}

    async def _run_curl_check(self) -> Dict[str, Any]:
        """Check tak-database container logs for successful startup."""
        version = self.directory_helper.get_takserver_version()
        if not version:
            return {'status': 'error', 'error': 'TAK Server version not found'}
        
        container_name = f"tak-database-{version}"
        try:
            # Get minimal logs needed for check
            result = await self.run_command.run_command_async(
                ['docker', 'logs', '--tail', '1', container_name],
                'health_check',
                ignore_errors=True
            )
            
            # Fast single-line pattern match
            if "server started" in result.stdout.lower():
                return {'status': 'up'}
                
            if "no such container" in result.stderr.lower():
                return {'status': 'down', 'error': f'Container {container_name} not found'}
                
            return {'status': 'down', 'error': 'Server start not detected'}
            
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def check_webui_availability(self) -> Dict[str, Any]:
        """Check if database server starts within 60 seconds."""
        start_time = time.time()
        timeout = 60
        
        while (time.time() - start_time) < timeout:
            result = await self._run_curl_check()
            if result['status'] == 'up':
                return {
                    'status': 'available',
                    'message': 'Database startup complete',
                    'error': None
                }
            await asyncio.sleep(1)  # Check every second

        logger.error('Database startup timeout')
        return {
            'status': 'unavailable',
            'error': 'Timeout: Server did not complete startup within 60 seconds'
        }

    async def _check_database_logs(self) -> bool:
        """Check tak-database container logs for authentication errors."""
        version = self.directory_helper.get_takserver_version()
        if not version:
            return False

        container_name = f"tak-database-{version}"
        try:
            result = await self.run_command.run_command_async(
                ['docker', 'logs', '--tail', '50', container_name],
                'health_check',
                ignore_errors=True
            )
            
            # Look for the specific authentication error
            return "FATAL: password authentication failed for user \"martiuser\"" in result.stdout
        except Exception as e:
            logger.error(f"Error checking database logs: {str(e)}")
            return False
