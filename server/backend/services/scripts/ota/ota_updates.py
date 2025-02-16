import os
import tempfile
import shutil
import zipfile
import json
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from backend.services.scripts.ota.generate_content import GenerateOTAContent
from backend.services.scripts.takserver.check_status import TakServerStatus
from typing import Dict, Any, Optional, Callable
import time
import asyncio
import docker
from backend.config.logging_config import configure_logging
from backend.services.helpers.directories import DirectoryHelper

# Configure logging using centralized config
logger = configure_logging(__name__)

class OTAUpdate:
    def __init__(self, ota_zip_path, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.run_command = RunCommand()
        self.directory_helper = DirectoryHelper()
        self.generate_content = GenerateOTAContent()
        self.ota_zip_path = ota_zip_path
        self.emit_event = emit_event
        self.tak_status = TakServerStatus(emit_event=emit_event)
        self._last_status = None
        self.docker_client = docker.from_env()

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None) -> None:
        """Update installation status."""
        if self.emit_event:
            new_status = {
                "type": "status",
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            }
            
            # Only emit if status has changed
            if new_status != self._last_status:
                await self.emit_event(new_status)
                self._last_status = new_status

    async def update_dockerfile(self) -> None:
        """Updates the Dockerfile with new content."""
        try:
            version = self.directory_helper.get_takserver_version()
            docker_compose_dir = self.directory_helper.get_docker_compose_directory(version)
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")

            if not os.path.exists(dockerfile_path):
                logger.error(f"Dockerfile not found at {dockerfile_path}")
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            new_dockerfile_content = self.generate_content.update_dockerfile()

            with open(dockerfile_path, 'w') as dockerfile:
                dockerfile.write(new_dockerfile_content)
        except Exception as e:
            logger.error(f"Error updating Dockerfile: {str(e)}")
            raise

    async def rebuild_takserver(self) -> None:
        """Rebuild and restart TAK Server containers."""
        try:
            version = self.directory_helper.get_takserver_version()
            docker_compose_dir = self.directory_helper.get_docker_compose_directory(version)
            
            # Build and start containers using docker-compose
            logger.info("Building and starting Docker containers...")
            result = await self.run_command.run_command_async(
                ["docker-compose", "up", "-d", "--build", "--force-recreate"],
                'ota',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if not result.success:
                raise Exception(f"Failed to rebuild containers: {result.stderr}")

        except Exception as e:
            logger.error(f"Error in rebuild_takserver: {str(e)}")
            raise

    async def check_if_generate_inf_script_exists(self) -> bool:
        try:
            script_path = self.directory_helper.get_generate_inf_script_path()
            version = self.directory_helper.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            try:
                container = self.docker_client.containers.get(takserver_container_name)
                exit_code, _ = container.exec_run(f"test -f {script_path}")
                return exit_code == 0
            except docker.errors.NotFound:
                return False
            except Exception:
                return False
        except Exception:
            raise

    async def create_generate_inf_script(self) -> None:
        temp_script_path = None
        try:
            version = self.directory_helper.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            script_exists = await self.check_if_generate_inf_script_exists()
            if script_exists:
                return

            generate_inf_script_content = self.generate_content.generate_inf_content()

            # Create temporary script file
            with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.sh') as temp_script_file:
                temp_script_file.write(generate_inf_script_content)
                temp_script_path = temp_script_file.name

            try:
                # Use docker cp command instead of put_archive
                copy_command = [
                    'docker', 'cp', 
                    temp_script_path, 
                    f"{takserver_container_name}:/opt/android-sdk/build-tools/33.0.0/generate-inf.sh"
                ]
                
                result = await self.run_command.run_command_async(
                    copy_command,
                    'ota',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )
                
                if not result.success:
                    raise Exception(f"Failed to copy script to container: {result.stderr}")

                # Convert line endings and make executable
                container = self.docker_client.containers.get(takserver_container_name)
                container.exec_run('dos2unix /opt/android-sdk/build-tools/33.0.0/generate-inf.sh')
                container.exec_run('chmod +x /opt/android-sdk/build-tools/33.0.0/generate-inf.sh')

            except docker.errors.NotFound:
                raise Exception(f"Container {takserver_container_name} not found")
            except Exception:
                raise Exception("Error creating script in container")

        except Exception:
            raise
        finally:
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)

    async def check_and_remove_existing_plugin_folder(self) -> None:
        try:
            version = self.directory_helper.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-d', '/opt/tak/webcontent/plugins'
            ]
            result = await self.run_command.run_command_async(
                check_command,
                'ota',
                emit_event=self.emit_event,
                ignore_errors=True
            )

            if result.success:
                remove_command = [
                    'docker', 'exec', takserver_container_name, 'rm', '-rf', '/opt/tak/webcontent/plugins'
                ]
                result = await self.run_command.run_command_async(
                    remove_command,
                    'ota',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )
                if not result.success:
                    raise Exception(result.stderr)
        except Exception as e:
            raise

    async def extract_and_prepare_plugins(self) -> None:
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(self.ota_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if root != temp_dir:
                            shutil.move(file_path, os.path.join(temp_dir, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))

                version = self.directory_helper.get_takserver_version()
                takserver_container_name = f"takserver-{version}"

                copy_command = [
                    'docker', 'cp', f'{temp_dir}/.', f'{takserver_container_name}:/opt/tak/webcontent/plugins'
                ]
                result = await self.run_command.run_command_async(
                    copy_command,
                    'ota',
                    emit_event=self.emit_event,
                    ignore_errors=True
                )
                if not result.success:
                    raise Exception(result.stderr)
        except Exception as e:
            raise

    async def run_generate_inf_script(self) -> None:
        try:
            version = self.directory_helper.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            command = [
                'docker', 'exec', takserver_container_name,
                'bash', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh',
                '/opt/tak/webcontent/plugins', 'true'
            ]

            result = await self.run_command.run_command_async(
                command,
                'ota',
                emit_event=self.emit_event,
                ignore_errors=True
            )

            if not result.success:
                logger.error(f"Error running generate-inf script: {result.stderr}")
                raise Exception(f"Failed to run generate-inf script: {result.stderr}")

        except Exception as e:
            logger.error(f"Error in run_generate_inf_script: {str(e)}")
            raise

    async def main(self) -> bool:
        """Main configuration process"""
        try:
            # Send initial 0% progress
            await self.update_status("in_progress", 0, "Initializing OTA configuration process")

            # Define task weights
            weights = {
                'setup': 2,          # Initial checks and setup
                'config': 3,         # Dockerfile and docker-compose updates
                'docker_build': 48,  # Docker rebuild weight
                'plugins': 45,       # Plugin operations
                'script': 2          # Generate inf script operations
            }
            progress = 0

            # Emit started status
            await self.update_status("started", progress, "Starting OTA configuration process")

            # Check TAKServer status (0-2%)
            await self.update_status("in_progress", progress, "Checking TAKServer status...")
            await self.tak_status.stop_containers()
            progress += weights['setup']
            await self.update_status("in_progress", progress, "TAKServer status verified")

            # Update Docker configs (2-5%)
            await self.update_status("in_progress", progress, "Updating Docker configurations...")
            await self.update_dockerfile()
            progress += weights['config'] * 0.5
            await self.update_status("in_progress", progress, "Dockerfile updated")
            
            # Rebuild TAKServer (5-53%)
            await self.update_status("in_progress", progress, "Starting Docker rebuild process")
            
            # Create a background task to update progress during docker build
            build_start_progress = progress
            build_weight = weights['docker_build']
            
            async def update_build_progress():
                build_progress = 0
                while build_progress < build_weight:
                    await asyncio.sleep(2)  # Update every 2 seconds
                    build_progress = min(build_progress + 1, build_weight * 0.95)  # Cap at 95% of build weight
                    await self.update_status("in_progress", build_start_progress + build_progress, 
                                          "Building Docker containers...")
            
            # Start progress updater task
            progress_task = asyncio.create_task(update_build_progress())
            
            # Perform actual docker build
            await self.rebuild_takserver()
            
            # Cancel progress updater and set final build progress
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass
            
            progress = build_start_progress + weights['docker_build']
            await self.update_status("in_progress", progress, "Docker containers rebuilt")

            # Setup generate-inf script (53-55%)
            await self.update_status("in_progress", progress, "Setting up generate-inf script")
            await self.create_generate_inf_script()
            progress += weights['script']
            await self.update_status("in_progress", progress, "Generate-inf script setup completed")

            # Handle plugins (55-100%)
            await self.update_status("in_progress", progress, "Processing plugins")
            plugin_start_progress = progress
            plugin_weight = weights['plugins']

            async def update_plugin_progress():
                plugin_progress = 0
                while plugin_progress < plugin_weight:
                    await asyncio.sleep(2)  # Update every 2 seconds
                    plugin_progress = min(plugin_progress + 1, plugin_weight * 0.95)
                    await self.update_status("in_progress", plugin_start_progress + plugin_progress,
                                          "Processing plugins...")

            plugin_progress_task = asyncio.create_task(update_plugin_progress())

            await self.check_and_remove_existing_plugin_folder()
            await self.extract_and_prepare_plugins()
            await self.run_generate_inf_script()
            await self.tak_status.restart_containers()

            plugin_progress_task.cancel()
            try:
                await plugin_progress_task
            except asyncio.CancelledError:
                pass

            progress = 100
            
            # Emit completion status
            await self.update_status("complete", progress, "Configuration completed successfully")
            return True
        except Exception as e:
            await self.update_status("error", 100, "Configuration failed", str(e))
            return False

    async def update(self) -> bool:
        """Update plugins process"""
        try:
            # Send initial 0% progress
            await self.update_status("in_progress", 0, "Initializing OTA update process")

            # Define task weights for update process
            weights = {
                'setup': 10,     # Initial checks
                'plugins': 80,    # Plugin operations (main task for update)
                'script': 10      # Generate inf script operations
            }
            progress = 0

            # Emit started status
            await self.update_status("started", progress, "Starting OTA update process")

            # Check TAKServer status (0-10%)
            await self.update_status("in_progress", progress, "Checking TAKServer status...")
            await self.tak_status.start_containers()
            progress += weights['setup']
            await self.update_status("in_progress", progress, "TAKServer status verified")

            # Handle plugins (10-90%)
            await self.update_status("in_progress", progress, "Processing plugins...")
            plugin_start_progress = progress
            plugin_weight = weights['plugins']

            async def update_plugin_progress():
                plugin_progress = 0
                while plugin_progress < plugin_weight:
                    await asyncio.sleep(2)  # Update every 2 seconds
                    plugin_progress = min(plugin_progress + 1, plugin_weight * 0.95)
                    await self.update_status("in_progress", plugin_start_progress + plugin_progress,
                                          "Processing plugins...")

            plugin_progress_task = asyncio.create_task(update_plugin_progress())

            await self.check_and_remove_existing_plugin_folder()
            await self.extract_and_prepare_plugins()

            plugin_progress_task.cancel()
            try:
                await plugin_progress_task
            except asyncio.CancelledError:
                pass

            progress += weights['plugins']

            # Generate inf script (90-100%)
            await self.update_status("in_progress", progress, "Running generate-inf script")
            await self.create_generate_inf_script()
            await self.run_generate_inf_script()
            await self.tak_status.restart_containers()
            progress = 100
            
            # Emit completion status
            await self.update_status("complete", progress, "Update completed successfully")
            return True
        except Exception as e:
            await self.update_status("error", 100, "Update failed", str(e))
            return False
