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
            ["docker-compose", "up", "-d"],
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
            ["docker-compose", "down"],
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
            ["docker-compose", "restart"],
            'operation',
            working_dir=docker_compose_dir,
            ignore_errors=False
        )
        
        if not result.success:
            logger.error(f"Failed to restart containers: {result.stderr}")
            raise RuntimeError(f"Failed to restart containers: {result.stderr}")
        
        logger.info("Containers restarted")
        return {"status": "success", "message": "Containers restarted"}

    async def check_webui_availability(self) -> Dict[str, Any]:
        """Check if TAK Server web UI becomes available within 30 seconds."""
        start_time = time.time()
        timeout = 30  # seconds
        last_error = None
        
        while (time.time() - start_time) < timeout:
            result = await self._run_curl_check()
            if result['status'] == 'up':
                return {
                    'status': 'available',
                    'message': 'Web UI is reachable',
                    'error': result.get('error')
                }
            last_error = result.get('error')
            await asyncio.sleep(1)

        logger.error(f'Timeout: {last_error}' if last_error else 'Web UI did not become reachable within 30 seconds')
        return {
            'status': 'unavailable',
            'error': f'Timeout: {last_error}' if last_error else 'Web UI did not become reachable within 30 seconds'
        }

    async def _run_curl_check(self) -> Dict[str, Any]:
        """Run curl command inside takserver container to check web UI availability."""
        version = self.directory_helper.get_takserver_version()
        if not version:
            logger.error('TAK Server version not found for web UI check')
            return {'status': 'error', 'error': 'TAK Server version not found'}
        
        container_name = f"takserver-{version}"
        command = [
            'docker', 'exec', container_name,
            'curl', '-k', '--head', 'https://localhost:8443'
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            exit_code = await process.wait()

            # Interpret curl exit codes
            if exit_code == 56:  # Certificate error but server is up
                return {'status': 'up'}
            elif exit_code == 35:  # Connection failed
                logger.error(f'Web UI Connection failed: {stderr.decode().strip()}')
                return {'status': 'down', 'error': stderr.decode().strip()}
            elif exit_code == 1:  # Container not running
                return {'status': 'down', 'error': f'Container {container_name} not running'}
            else:
                return {'status': 'error', 'error': stderr.decode().strip()}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
