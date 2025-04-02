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
            logger.error(f"Error getting status: {str(e)}")
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

    async def _check_server_ready(self) -> Dict[str, Any]:
        """Check takserver.log for the final startup message in recent logs only."""
        version = self.directory_helper.get_takserver_version()
        if not version:
            logger.error("TAK Server version not found")
            return {'status': 'error', 'error': 'TAK Server version not found'}
        
        container_name = f"takserver-{version}"
        try:
            # Check ONLY the last 10 lines of the log file for the ready message
            # This prevents finding old startup messages from previous runs
            log_cmd = "tail -n 10 /opt/tak/logs/takserver.log | grep -a 'Retention Application started'"
            result = await self.run_command.run_command_async(
                ["docker", "exec", container_name, "bash", "-c", log_cmd],
                'health_check',
                ignore_errors=True
            )
            
            if result.success and "Retention Application started" in result.stdout:
                # Also check the timestamp to ensure it's recent (within last 5 minutes)
                timestamp_cmd = "tail -n 10 /opt/tak/logs/takserver.log | grep -a 'Retention Application started' | cut -d' ' -f1"
                timestamp_result = await self.run_command.run_command_async(
                    ["docker", "exec", container_name, "bash", "-c", timestamp_cmd],
                    'health_check',
                    ignore_errors=True
                )
                
                if timestamp_result.success and timestamp_result.stdout.strip():
                    # Log entry found and is recent
                    logger.info(f"Found recent startup message: {timestamp_result.stdout.strip()}")
                    return {'status': 'up'}
                
            if "no such container" in result.stderr.lower():
                logger.error(f'Container {container_name} not found')
                return {'status': 'down', 'error': f'Container {container_name} not found'}
                
            logger.error('Server initialization not complete')
            return {'status': 'initializing', 'error': 'Server initialization not complete'}
            
        except Exception as e:
            logger.error(f"Error checking server readiness: {str(e)}")
            return {'status': 'error', 'error': str(e)}

    async def check_webui_availability(self) -> Dict[str, Any]:
        """Check if TAK Server is fully initialized within timeout period."""
        start_time = time.time()
        timeout = 120  # 2 minutes timeout
        
        # First check if container is running
        status = await self.get_status()
        if not status['isRunning']:
            logger.error('TAK Server is not running')
            return {
                'status': 'unavailable',
                'message': 'TAK Server is not running',
                'error': 'Server must be started first'
            }
            
        # Log the check but don't emit events
        logger.info("Checking TAK Server readiness...")
        
        # Poll for server readiness
        while (time.time() - start_time) < timeout:
            result = await self._check_server_ready()
            
            if result['status'] == 'up':
                logger.info("TAK Server fully initialized and ready")
                return {
                    'status': 'available',
                    'message': 'TAK Server is fully initialized',
                    'error': None
                }
                
            # Progress update in logs only
            elapsed = int(time.time() - start_time)
            if elapsed % 15 == 0 and elapsed > 0:
                logger.info(f"Still waiting for TAK Server initialization ({elapsed}s elapsed)...")
                
            await asyncio.sleep(2)  # Check every 2 seconds

        # Timeout occurred
        logger.error('TAK Server initialization timeout after %d seconds', timeout)
        return {
            'status': 'unavailable',
            'message': 'TAK Server is still initializing',
            'error': f'Timeout: Server did not complete initialization within {timeout} seconds'
        }

