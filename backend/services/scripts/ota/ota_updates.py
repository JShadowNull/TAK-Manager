import os
import tempfile
import eventlet
import shutil
import zipfile
from pathlib import Path
from eventlet.green import threading  # Use green threading
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
from backend.services.scripts.ota.generate_content import GenerateOTAContent
from backend.services.helpers.os_detector import OSDetector
from backend.services.scripts.takserver.check_status import TakServerStatus
from backend.services.helpers.operation_status import OperationStatus
import subprocess

class OTAUpdate:
    def __init__(self, ota_zip_path):
        self.ota_zip_path = ota_zip_path  # Store the path to the OTA zip file
        self.run_command = RunCommand()
        self.generate_content = GenerateOTAContent()
        self.stop_event = threading.Event()
        self.os_detector = OSDetector()
        self.tak_status = TakServerStatus()
        self.completed_steps = []
        self.operation_status = OperationStatus(namespace='/ota-update')

    def check_stop(self):
        if self.stop_event.is_set():
            raise Exception("Configuration stopped by user.")
        
    def install_rosetta_on_mac(self):
        """
        Detects if the operating system is macOS and installs Rosetta if it is.
        """
        self.operation_status.update_progress('ota_update', 5, "Checking if Rosetta installation is needed")
        os_type = self.os_detector.detect_os()
        if os_type == 'macos':
            self.operation_status.update_progress('ota_update', 7, "macOS detected, installing Rosetta")
            install_rosetta_command = ['softwareupdate', '--install-rosetta', '--agree-to-license']
            self.run_command.run_command(install_rosetta_command, namespace='ota-update', capture_output=False)
            self.operation_status.update_progress('ota_update', 10, "Rosetta installed successfully")
        else:
            self.operation_status.update_progress('ota_update', 10, "Operating system is not macOS, skipping Rosetta installation")
        
    def check_takserver_running(self):
        """Check and start TAKServer containers if needed"""
        self.operation_status.update_progress('ota_update', 15, "Checking TAKServer status")
        
        if not self.tak_status.check_installation():
            error_details = {'error': 'TAKServer is not installed'}
            self.operation_status.fail_operation('ota_update', "TAKServer is not installed", error_details)
            raise Exception("TAKServer is not installed")
            
        if not self.tak_status.check_containers_running():
            self.operation_status.update_progress('ota_update', 20, "Starting TAKServer containers")
            success = self.tak_status.start_containers()
            if not success:
                error_details = {'error': 'Failed to start TAKServer containers'}
                self.operation_status.fail_operation('ota_update', "Failed to start TAKServer containers", error_details)
                raise Exception("Failed to start TAKServer containers")
        else:
            self.operation_status.update_progress('ota_update', 20, "TAKServer containers are already running")
        
    def update_dockerfile(self):
        """
        Updates the Dockerfile located in the working directory with the new content.
        """
        try:
            self.operation_status.update_progress('ota_update', 25, "Updating Dockerfile with new content")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")

            if not os.path.exists(dockerfile_path):
                error_details = {'error': f"Dockerfile not found at {dockerfile_path}"}
                self.operation_status.fail_operation('ota_update', f"Dockerfile not found at {dockerfile_path}", error_details)
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            new_dockerfile_content = self.generate_content.update_dockerfile()

            with open(dockerfile_path, 'w') as dockerfile:
                dockerfile.write(new_dockerfile_content)

            self.operation_status.update_progress('ota_update', 30, "Dockerfile updated successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to update Dockerfile: {str(e)}", error_details)
            raise
        
    def update_docker_compose_file(self):
        """
        Updates the docker-compose.yml located in the working directory with the new content.
        """
        try:
            self.operation_status.update_progress('ota_update', 35, "Updating docker-compose.yml")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockercompose_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockercompose_path):
                error_details = {'error': f"docker-compose.yml not found at {dockercompose_path}"}
                self.operation_status.fail_operation('ota_update', f"docker-compose.yml not found at {dockercompose_path}", error_details)
                raise FileNotFoundError(f"docker-compose.yml not found at {dockercompose_path}")

            new_dockercompose_content = self.generate_content.update_docker_compose_file()

            with open(dockercompose_path, 'w') as dockercompose:
                dockercompose.write(new_dockercompose_content)

            self.operation_status.update_progress('ota_update', 40, "docker-compose.yml updated successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to update docker-compose.yml: {str(e)}", error_details)
            raise

    def rebuild_takserver(self):
        try:
            self.operation_status.update_progress('ota_update', 45, "Starting Docker container rebuild process")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")
            compose_file_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockerfile_path) or not os.path.exists(compose_file_path):
                error_details = {'error': 'Required Docker files not found'}
                self.operation_status.fail_operation('ota_update', "Required Docker files not found", error_details)
                raise FileNotFoundError("Required Docker files not found")

            self.operation_status.update_progress('ota_update', 50, "Running docker compose build")
            build_command = ['docker', 'compose', '-f', compose_file_path, 'build']
            self.run_command.run_command(build_command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 60, "Running docker compose up")
            up_command = ['docker', 'compose', '-f', compose_file_path, 'up', '-d', '--force-recreate']
            self.run_command.run_command(up_command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 70, "Docker containers rebuilt successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to rebuild Docker containers: {str(e)}", error_details)
            raise

    def check_if_generate_inf_script_exists(self):
        try:
            self.operation_status.update_progress('ota_update', 75, "Checking for generate-inf.sh script")
            script_path = '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-f', script_path
            ]
            result = self.run_command.run_command(check_command, namespace='ota-update', capture_output=True)

            if isinstance(result, subprocess.CompletedProcess):
                if result.returncode == 0:
                    self.operation_status.update_progress('ota_update', 77, "generate-inf.sh script found")
                    return True
                else:
                    self.operation_status.update_progress('ota_update', 77, "generate-inf.sh script not found")
                    return False
            else:
                error_details = {'error': f"Unexpected result type: {type(result)}"}
                self.operation_status.fail_operation('ota_update', "Failed to check for generate-inf.sh script", error_details)
                return False
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Error checking for generate-inf.sh script: {str(e)}", error_details)
            raise

    def create_generate_inf_script(self):
        temp_script_path = None
        try:
            self.operation_status.update_progress('ota_update', 80, "Setting up generate-inf.sh script")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            script_exists = self.check_if_generate_inf_script_exists()
            if script_exists:
                self.operation_status.update_progress('ota_update', 85, "generate-inf.sh script already exists")
                return

            generate_inf_script_content = self.generate_content.generate_inf_content()

            with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.sh') as temp_script_file:
                temp_script_file.write(generate_inf_script_content)
                temp_script_path = temp_script_file.name

            self.operation_status.update_progress('ota_update', 82, "Copying script to container")
            copy_command = [
                'docker', 'cp', temp_script_path, f'{takserver_container_name}:/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(copy_command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 85, "Setting up script permissions")
            dos2unix_command = [
                'docker', 'exec', takserver_container_name, 'dos2unix', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            chmod_command = [
                'docker', 'exec', takserver_container_name, 'chmod', '+x', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(dos2unix_command, namespace='ota-update', capture_output=False)
            self.run_command.run_command(chmod_command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 87, "generate-inf.sh script setup completed")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to create generate-inf.sh script: {str(e)}", error_details)
            raise
        finally:
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)
                
    def check_and_remove_existing_plugin_folder(self):
        try:
            self.operation_status.update_progress('ota_update', 90, "Checking plugins folder")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-d', '/opt/tak/webcontent/plugins'
            ]
            result = self.run_command.run_command(check_command, namespace='ota-update', capture_output=True)

            if result.returncode == 0:
                self.operation_status.update_progress('ota_update', 92, "Removing existing plugins folder")
                remove_command = [
                    'docker', 'exec', takserver_container_name, 'rm', '-rf', '/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(remove_command, namespace='ota-update', capture_output=False)
                self.operation_status.update_progress('ota_update', 93, "Existing plugins folder removed")
            else:
                self.operation_status.update_progress('ota_update', 93, "No existing plugins folder found")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to check/remove plugins folder: {str(e)}", error_details)
            raise

    def extract_and_prepare_plugins(self, ota_zip_path):
        try:
            self.operation_status.update_progress('ota_update', 94, "Extracting OTA zip file")

            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(ota_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                self.operation_status.update_progress('ota_update', 95, "Processing extracted files")
                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if root != temp_dir:
                            shutil.move(file_path, os.path.join(temp_dir, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))

                version = self.tak_status.get_takserver_version()
                takserver_container_name = f"takserver-{version}"

                self.operation_status.update_progress('ota_update', 97, "Copying plugins to container")
                copy_command = [
                    'docker', 'cp', f'{temp_dir}/.', f'{takserver_container_name}:/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(copy_command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 98, "Plugins prepared successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to extract and prepare plugins: {str(e)}", error_details)
            raise

    def run_generate_inf_script(self):
        try:
            self.operation_status.update_progress('ota_update', 99, "Running generate-inf.sh script")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            command = [
                'docker', 'exec', takserver_container_name, 'bash', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh', '/opt/tak/webcontent/plugins', 'true'
            ]
            self.run_command.run_command(command, namespace='ota-update', capture_output=False)

            self.operation_status.update_progress('ota_update', 100, "generate-inf.sh script executed successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to run generate-inf.sh script: {str(e)}", error_details)
            raise

    def restart_takserver_containers(self):
        """Restart TAKServer containers using TakServerStatus"""
        try:
            self.operation_status.update_progress('ota_update', 100, "Restarting TAKServer containers")
            success = self.tak_status.restart_containers()
            if not success:
                error_details = {'error': 'Failed to restart TAKServer containers'}
                self.operation_status.fail_operation('ota_update', "Failed to restart TAKServer containers", error_details)
                raise Exception("Failed to restart TAKServer containers")
            self.operation_status.update_progress('ota_update', 100, "TAKServer containers restarted successfully")
        except Exception as e:
            error_details = {'error': str(e)}
            self.operation_status.fail_operation('ota_update', f"Failed to restart TAKServer containers: {str(e)}", error_details)
            raise

    def main(self):
        """Main OTA update process"""
        try:
            initial_details = {
                'isUpdating': True,
                'updateComplete': False,
                'updateSuccess': False,
                'updateError': None
            }
            self.operation_status.start_operation('ota_update', "Starting OTA update process", initial_details)
            
            self.install_rosetta_on_mac()
            self.check_takserver_running()
            self.update_dockerfile()
            self.update_docker_compose_file()
            self.rebuild_takserver()
            self.create_generate_inf_script()
            self.check_and_remove_existing_plugin_folder()
            self.extract_and_prepare_plugins(self.ota_zip_path)
            self.run_generate_inf_script()
            self.restart_takserver_containers()
            
            success_details = {
                'isUpdating': False,
                'updateComplete': True,
                'updateSuccess': True,
                'updateError': None
            }
            self.operation_status.complete_operation('ota_update', "OTA update completed successfully", success_details)
            return True
        except Exception as e:
            error_details = {
                'isUpdating': False,
                'updateComplete': True,
                'updateSuccess': False,
                'updateError': str(e)
            }
            self.operation_status.fail_operation('ota_update', f"OTA update failed: {str(e)}", error_details)
            return False

    def update(self):
        """OTA update process"""
        try:
            initial_details = {
                'isUpdating': True,
                'updateComplete': False,
                'updateSuccess': False,
                'updateError': None
            }
            self.operation_status.start_operation('ota_update', "Starting OTA update process", initial_details)
            
            self.check_takserver_running()
            self.check_and_remove_existing_plugin_folder()
            self.extract_and_prepare_plugins(self.ota_zip_path)
            self.run_generate_inf_script()
            self.restart_takserver_containers()
            
            success_details = {
                'isUpdating': False,
                'updateComplete': True,
                'updateSuccess': True,
                'updateError': None
            }
            self.operation_status.complete_operation('ota_update', "OTA update completed successfully", success_details)
            return True
        except Exception as e:
            error_details = {
                'isUpdating': False,
                'updateComplete': True,
                'updateSuccess': False,
                'updateError': str(e)
            }
            self.operation_status.fail_operation('ota_update', f"OTA update failed: {str(e)}", error_details)
            return False
