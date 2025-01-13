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
import subprocess
import time
import asyncio
from backend.config.logging_config import configure_logging

# Configure logging using centralized config
logger = configure_logging(__name__)

class OTAUpdate:
    def __init__(self, ota_zip_path, emit_event: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.ota_zip_path = ota_zip_path  # Store the path to the OTA zip file
        self.run_command = RunCommand()
        self.generate_content = GenerateOTAContent()
        self.tak_status = TakServerStatus()
        self.installation_progress = 0
        self.status = 'processing'
        self.error = None
        self.message = ''
        self.emit_event = emit_event
        logger.debug(f"OTAUpdate initialized with zip path: {json.dumps({'ota_zip_path': ota_zip_path})}")

    def _create_event(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an event object for SSE"""
        event_data = {
            'type': event_type,
            'data': {
                **data,
                'timestamp': time.time()
            }
        }
        logger.debug(f"Created event: {event_data}")
        if self.emit_event:
            self.emit_event(event_data)
        return event_data
        
    def update_progress(self, progress, message, status='processing', channel: str = 'ota-update'):
        """Update installation progress"""
        self.installation_progress = progress
        self.message = message
        self.status = status
        self._create_event('ota_status', {
            'status': status,
            'progress': progress,
            'message': message
        })
        logger.debug(f"Progress update: {json.dumps({'progress': progress, 'message': message, 'status': status})}")
        
    def get_progress(self):
        """Get current installation progress"""
        progress_info = {
            'progress': self.installation_progress,
            'status': self.status,
            'message': self.message
        }
        if self.error:
            progress_info['error'] = self.error
            progress_info['status'] = 'error'
        
        logger.debug(f"Progress info: {json.dumps(progress_info)}")
        return progress_info

    def set_error(self, error_message, channel: str = 'ota-update'):
        """Set error state"""
        self.error = error_message
        self.status = 'error'
        self._create_event('ota_status', {
            'status': 'error',
            'message': error_message,
            'error': error_message,
            'isInProgress': False
        })
        logger.error(f"Error set: {error_message}")

    def check_takserver_running(self, channel: str = 'ota-update'):
        """Check and start TAKServer containers if needed"""
        self.update_progress(15, "Checking TAKServer status", channel=channel)
        
        if not self.tak_status.check_installation():
            raise Exception("TAKServer is not installed")
            
        if not self.tak_status.check_containers_running():
            self.update_progress(20, "Starting TAKServer containers", channel=channel)
            success = self.tak_status.start_containers()
            if not success:
                raise Exception("Failed to start TAKServer containers")

    def update_dockerfile(self, channel: str = 'ota-update'):
        """Updates the Dockerfile with new content."""
        try:
            self.update_progress(25, "Updating Dockerfile with new content", channel=channel)

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")

            if not os.path.exists(dockerfile_path):
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            new_dockerfile_content = self.generate_content.update_dockerfile()

            with open(dockerfile_path, 'w') as dockerfile:
                dockerfile.write(new_dockerfile_content)

            self.update_progress(30, "Dockerfile updated successfully", channel=channel)
        except Exception as e:
            raise

    def update_docker_compose_file(self, channel: str = 'ota-update'):
        """Updates the docker-compose.yml with new content."""
        try:
            self.update_progress(35, "Updating docker-compose.yml", channel=channel)

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockercompose_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockercompose_path):
                raise FileNotFoundError(f"docker-compose.yml not found at {dockercompose_path}")

            new_dockercompose_content = self.generate_content.update_docker_compose_file()

            with open(dockercompose_path, 'w') as dockercompose:
                dockercompose.write(new_dockercompose_content)

            self.update_progress(40, "docker-compose.yml updated successfully", channel=channel)
        except Exception as e:
            raise

    def rebuild_takserver(self, channel: str = 'ota-update'):
        try:
            self.update_progress(45, "Starting Docker container rebuild process", channel=channel)

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")
            compose_file_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockerfile_path) or not os.path.exists(compose_file_path):
                raise FileNotFoundError("Required Docker files not found")

            self.update_progress(50, "Running docker compose build", channel=channel)
            build_command = ['docker-compose', '-f', compose_file_path, 'build']
            self.run_command.run_command(
                build_command,
                'docker_build',
                capture_output=False,
                emit_event=self.emit_event
            )

            self.update_progress(60, "Running docker compose up", channel=channel)
            up_command = ['docker-compose', '-f', compose_file_path, 'up', '-d', '--force-recreate']
            self.run_command.run_command(
                up_command,
                'docker_up',
                capture_output=False,
                emit_event=self.emit_event
            )

            self.update_progress(70, "Docker containers rebuilt successfully", channel=channel)
        except Exception as e:
            raise

    def check_if_generate_inf_script_exists(self, channel: str = 'ota-update'):
        try:
            self.update_progress(75, "Checking for generate-inf.sh script", channel=channel)
            script_path = '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-f', script_path
            ]
            result = self.run_command.run_command(
                check_command,
                'check_script',
                capture_output=True,
                emit_event=self.emit_event
            )

            if isinstance(result, subprocess.CompletedProcess):
                if result.returncode == 0:
                    self.update_progress(77, "generate-inf.sh script found", channel=channel)
                    return True
                else:
                    self.update_progress(77, "generate-inf.sh script not found", channel=channel)
                    return False
            else:
                return False
        except Exception as e:
            raise

    def create_generate_inf_script(self, channel: str = 'ota-update'):
        temp_script_path = None
        try:
            self.update_progress(80, "Setting up generate-inf.sh script", channel=channel)

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            script_exists = self.check_if_generate_inf_script_exists(channel)
            if script_exists:
                self.update_progress(85, "generate-inf.sh script already exists", channel=channel)
                return

            generate_inf_script_content = self.generate_content.generate_inf_content()

            with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.sh') as temp_script_file:
                temp_script_file.write(generate_inf_script_content)
                temp_script_path = temp_script_file.name

            self.update_progress(82, "Copying script to container", channel=channel)
            copy_command = [
                'docker', 'cp', temp_script_path, f'{takserver_container_name}:/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(
                copy_command,
                'copy_script',
                capture_output=False,
                emit_event=self.emit_event
            )

            self.update_progress(85, "Setting up script permissions", channel=channel)
            dos2unix_command = [
                'docker', 'exec', takserver_container_name, 'dos2unix', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            chmod_command = [
                'docker', 'exec', takserver_container_name, 'chmod', '+x', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(
                dos2unix_command,
                'dos2unix',
                capture_output=False,
                emit_event=self.emit_event
            )
            self.run_command.run_command(
                chmod_command,
                'chmod',
                capture_output=False,
                emit_event=self.emit_event
            )

            self.update_progress(87, "generate-inf.sh script setup completed", channel=channel)
        except Exception as e:
            raise
        finally:
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)

    def check_and_remove_existing_plugin_folder(self, channel: str = 'ota-update'):
        try:
            self.update_progress(90, "Checking plugins folder", channel=channel)

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-d', '/opt/tak/webcontent/plugins'
            ]
            result = self.run_command.run_command(
                check_command,
                'check_plugins',
                capture_output=True,
                emit_event=self.emit_event
            )

            if result.returncode == 0:
                self.update_progress(92, "Removing existing plugins folder", channel=channel)
                remove_command = [
                    'docker', 'exec', takserver_container_name, 'rm', '-rf', '/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(
                    remove_command,
                    'remove_plugins',
                    capture_output=False,
                    emit_event=self.emit_event
                )
                self.update_progress(93, "Existing plugins folder removed", channel=channel)
            else:
                self.update_progress(93, "No existing plugins folder found", channel=channel)
        except Exception as e:
            raise

    def extract_and_prepare_plugins(self, ota_zip_path, channel: str = 'ota-update'):
        try:
            self.update_progress(94, "Extracting OTA zip file", channel=channel)

            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(ota_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                self.update_progress(95, "Processing extracted files", channel=channel)
                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if root != temp_dir:
                            shutil.move(file_path, os.path.join(temp_dir, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))

                version = self.tak_status.get_takserver_version()
                takserver_container_name = f"takserver-{version}"

                self.update_progress(97, "Copying plugins to container", channel=channel)
                copy_command = [
                    'docker', 'cp', f'{temp_dir}/.', f'{takserver_container_name}:/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(
                    copy_command,
                    'copy_plugins',
                    capture_output=False,
                    emit_event=self.emit_event
                )

            self.update_progress(98, "Plugins prepared successfully", channel=channel)
        except Exception as e:
            raise

    def run_generate_inf_script(self, channel: str = 'ota-update'):
        try:
            self.update_progress(99, "Running generate-inf.sh script", channel=channel)

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            command = [
                'docker', 'exec', takserver_container_name, 'bash', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh', '/opt/tak/webcontent/plugins', 'true'
            ]
            self.run_command.run_command(
                command,
                'generate_inf',
                capture_output=False,
                emit_event=self.emit_event
            )

            self.update_progress(100, "generate-inf.sh script executed successfully", channel=channel)
        except Exception as e:
            raise

    def restart_takserver_containers(self, channel: str = 'ota-update'):
        """Restart TAKServer containers using TakServerStatus"""
        try:
            self.update_progress(100, "Restarting TAKServer containers", channel=channel)
            success = self.tak_status.restart_containers()
            if not success:
                raise Exception("Failed to restart TAKServer containers")
            self.update_progress(100, "TAKServer containers restarted successfully", channel=channel)
        except Exception as e:
            raise

    def main(self, channel: str = 'ota-update'):
        """Main configuration process"""
        try:
            # Emit initial status
            self._create_event('ota_status', {
                'status': 'started',
                'message': 'Starting OTA configuration process',
                'progress': 0,
                'isInProgress': True
            })

            self.check_takserver_running(channel)
            self.update_dockerfile(channel)
            self.update_docker_compose_file(channel)
            self.rebuild_takserver(channel)
            self.check_and_remove_existing_plugin_folder(channel)
            self.extract_and_prepare_plugins(self.ota_zip_path, channel)
            self.create_generate_inf_script(channel)
            self.run_generate_inf_script(channel)
            
            # Emit completion status
            self._create_event('ota_status', {
                'status': 'completed',
                'message': 'Configuration completed successfully',
                'progress': 100,
                'isInProgress': False
            })
            self.update_progress(100, "Configuration completed successfully", 'complete', channel)
            return True
        except Exception as e:
            self.set_error(str(e), channel)
            return False

    def update(self, channel: str = 'ota-update'):
        """Update plugins process"""
        try:
            # Emit initial status
            self._create_event('ota_status', {
                'status': 'started',
                'message': 'Starting OTA update process',
                'progress': 0,
                'isInProgress': True
            })

            self.check_takserver_running(channel)
            self.check_and_remove_existing_plugin_folder(channel)
            self.extract_and_prepare_plugins(self.ota_zip_path, channel)
            self.create_generate_inf_script(channel)
            self.run_generate_inf_script(channel)
            
            # Emit completion status
            self._create_event('ota_status', {
                'status': 'completed',
                'message': 'Update completed successfully',
                'progress': 100,
                'isInProgress': False
            })
            self.update_progress(100, "Update completed successfully", 'complete', channel)
            return True
        except Exception as e:
            self.set_error(str(e), channel)
            return False