import os
import tempfile
import shutil
import zipfile
from pathlib import Path
from backend.services.helpers.run_command import RunCommand
from backend.services.scripts.ota.generate_content import GenerateOTAContent
from backend.services.scripts.takserver.check_status import TakServerStatus
import subprocess

class OTAUpdate:
    def __init__(self, ota_zip_path):
        self.ota_zip_path = ota_zip_path  # Store the path to the OTA zip file
        self.run_command = RunCommand()
        self.generate_content = GenerateOTAContent()
        self.tak_status = TakServerStatus()
        self.installation_progress = 0
        
    def update_progress(self, progress, message):
        """Update installation progress"""
        self.installation_progress = progress
        self.run_command.emit_log_output(message, 'ota-update')
        
    def get_progress(self):
        """Get current installation progress"""
        return {
            'progress': self.installation_progress,
            'status': 'in_progress' if self.installation_progress < 100 else 'complete'
        }
        
    def check_takserver_running(self):
        """Check and start TAKServer containers if needed"""
        self.update_progress(15, "Checking TAKServer status")
        
        if not self.tak_status.check_installation():
            raise Exception("TAKServer is not installed")
            
        if not self.tak_status.check_containers_running():
            self.update_progress(20, "Starting TAKServer containers")
            success = self.tak_status.start_containers()
            if not success:
                raise Exception("Failed to start TAKServer containers")
        
    def update_dockerfile(self):
        """Updates the Dockerfile with new content."""
        try:
            self.update_progress(25, "Updating Dockerfile with new content")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")

            if not os.path.exists(dockerfile_path):
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            new_dockerfile_content = self.generate_content.update_dockerfile()

            with open(dockerfile_path, 'w') as dockerfile:
                dockerfile.write(new_dockerfile_content)

            self.update_progress(30, "Dockerfile updated successfully")
        except Exception as e:
            raise
        
    def update_docker_compose_file(self):
        """Updates the docker-compose.yml with new content."""
        try:
            self.update_progress(35, "Updating docker-compose.yml")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockercompose_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockercompose_path):
                raise FileNotFoundError(f"docker-compose.yml not found at {dockercompose_path}")

            new_dockercompose_content = self.generate_content.update_docker_compose_file()

            with open(dockercompose_path, 'w') as dockercompose:
                dockercompose.write(new_dockercompose_content)

            self.update_progress(40, "docker-compose.yml updated successfully")
        except Exception as e:
            raise

    def rebuild_takserver(self):
        try:
            self.update_progress(45, "Starting Docker container rebuild process")

            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")
            compose_file_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockerfile_path) or not os.path.exists(compose_file_path):
                raise FileNotFoundError("Required Docker files not found")

            self.update_progress(50, "Running docker compose build")
            build_command = ['docker', 'compose', '-f', compose_file_path, 'build']
            self.run_command.run_command(build_command, capture_output=False)

            self.update_progress(60, "Running docker compose up")
            up_command = ['docker', 'compose', '-f', compose_file_path, 'up', '-d', '--force-recreate']
            self.run_command.run_command(up_command, capture_output=False)

            self.update_progress(70, "Docker containers rebuilt successfully")
        except Exception as e:
            raise

    def check_if_generate_inf_script_exists(self):
        try:
            self.update_progress(75, "Checking for generate-inf.sh script")
            script_path = '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-f', script_path
            ]
            result = self.run_command.run_command(check_command, capture_output=True)

            if isinstance(result, subprocess.CompletedProcess):
                if result.returncode == 0:
                    self.update_progress(77, "generate-inf.sh script found")
                    return True
                else:
                    self.update_progress(77, "generate-inf.sh script not found")
                    return False
            else:
                return False
        except Exception as e:
            raise

    def create_generate_inf_script(self):
        temp_script_path = None
        try:
            self.update_progress(80, "Setting up generate-inf.sh script")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            script_exists = self.check_if_generate_inf_script_exists()
            if script_exists:
                self.update_progress(85, "generate-inf.sh script already exists")
                return

            generate_inf_script_content = self.generate_content.generate_inf_content()

            with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.sh') as temp_script_file:
                temp_script_file.write(generate_inf_script_content)
                temp_script_path = temp_script_file.name

            self.update_progress(82, "Copying script to container")
            copy_command = [
                'docker', 'cp', temp_script_path, f'{takserver_container_name}:/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(copy_command, capture_output=False)

            self.update_progress(85, "Setting up script permissions")
            dos2unix_command = [
                'docker', 'exec', takserver_container_name, 'dos2unix', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            chmod_command = [
                'docker', 'exec', takserver_container_name, 'chmod', '+x', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(dos2unix_command, capture_output=False)
            self.run_command.run_command(chmod_command, capture_output=False)

            self.update_progress(87, "generate-inf.sh script setup completed")
        except Exception as e:
            raise
        finally:
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)
                
    def check_and_remove_existing_plugin_folder(self):
        try:
            self.update_progress(90, "Checking plugins folder")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-d', '/opt/tak/webcontent/plugins'
            ]
            result = self.run_command.run_command(check_command, capture_output=True)

            if result.returncode == 0:
                self.update_progress(92, "Removing existing plugins folder")
                remove_command = [
                    'docker', 'exec', takserver_container_name, 'rm', '-rf', '/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(remove_command, capture_output=False)
                self.update_progress(93, "Existing plugins folder removed")
            else:
                self.update_progress(93, "No existing plugins folder found")
        except Exception as e:
            raise

    def extract_and_prepare_plugins(self, ota_zip_path):
        try:
            self.update_progress(94, "Extracting OTA zip file")

            with tempfile.TemporaryDirectory() as temp_dir:
                with zipfile.ZipFile(ota_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                self.update_progress(95, "Processing extracted files")
                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if root != temp_dir:
                            shutil.move(file_path, os.path.join(temp_dir, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))

                version = self.tak_status.get_takserver_version()
                takserver_container_name = f"takserver-{version}"

                self.update_progress(97, "Copying plugins to container")
                copy_command = [
                    'docker', 'cp', f'{temp_dir}/.', f'{takserver_container_name}:/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(copy_command, capture_output=False)

            self.update_progress(98, "Plugins prepared successfully")
        except Exception as e:
            raise

    def run_generate_inf_script(self):
        try:
            self.update_progress(99, "Running generate-inf.sh script")

            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            command = [
                'docker', 'exec', takserver_container_name, 'bash', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh', '/opt/tak/webcontent/plugins', 'true'
            ]
            self.run_command.run_command(command, capture_output=False)

            self.update_progress(100, "generate-inf.sh script executed successfully")
        except Exception as e:
            raise

    def restart_takserver_containers(self):
        """Restart TAKServer containers using TakServerStatus"""
        try:
            self.update_progress(100, "Restarting TAKServer containers")
            success = self.tak_status.restart_containers()
            if not success:
                raise Exception("Failed to restart TAKServer containers")
            self.update_progress(100, "TAKServer containers restarted successfully")
        except Exception as e:
            raise

    def main(self):
        """Main OTA update process"""
        try:
            self.update_progress(0, "Starting OTA configuration process")
            
            self.check_takserver_running()
            self.update_dockerfile()
            self.update_docker_compose_file()
            self.rebuild_takserver()
            self.create_generate_inf_script()
            self.check_and_remove_existing_plugin_folder()
            self.extract_and_prepare_plugins(self.ota_zip_path)
            self.run_generate_inf_script()
            self.restart_takserver_containers()
            
            return True
        except Exception as e:
            return False

    def update(self):
        """OTA update process"""
        try:
            self.update_progress(0, "Updating Plugins")
            
            self.check_takserver_running()
            self.check_and_remove_existing_plugin_folder()
            self.extract_and_prepare_plugins(self.ota_zip_path)
            self.run_generate_inf_script()
            self.restart_takserver_containers()
            
            return True
        except Exception as e:
            return False