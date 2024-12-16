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

    def check_stop(self):
        if self.stop_event.is_set():
            raise Exception("Configuration stopped by user.")
        
    def install_rosetta_on_mac(self):
        """
        Detects if the operating system is macOS and installs Rosetta if it is.
        """
        self.run_command.emit_log_output("Checking if the operating system is macOS...", 'ota-update')
        self.check_stop()

        os_type = self.os_detector.detect_os()
        if os_type == 'macos':
            self.run_command.emit_log_output("macOS detected. Installing Rosetta...", 'ota-update')
            install_rosetta_command = ['softwareupdate', '--install-rosetta', '--agree-to-license']
            self.run_command.run_command(install_rosetta_command, namespace='ota-update', capture_output=False)
            self.run_command.emit_log_output("Rosetta installed successfully.", 'ota-update')
        else:
            self.run_command.emit_log_output("Operating system is not macOS. Skipping Rosetta installation.", 'ota-update')
        
    def check_takserver_running(self):
        """Check and start TAKServer containers if needed"""
        self.run_command.emit_log_output("Checking TAKServer status...", 'ota-update')
        
        if not self.tak_status.check_installation():
            raise Exception("TAKServer is not installed")
            
        # Start the containers if they're not running
        if not self.tak_status.check_containers_running():
            self.run_command.emit_log_output("TAKServer containers not running. Starting them...", 'ota-update')
            success = self.tak_status.start_containers()
            if not success:
                raise Exception("Failed to start TAKServer containers")
        else:
            self.run_command.emit_log_output("TAKServer containers are already running.", 'ota-update')
        
    def update_dockerfile(self):
        """
        Updates the Dockerfile located in the working directory with the new content.
        """
        try:
            self.run_command.emit_log_output("Updating Dockerfile with new content...", 'ota-update')

            # Get the docker compose directory from TakServerStatus
            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")

            if not os.path.exists(dockerfile_path):
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            # Get the new Dockerfile content
            new_dockerfile_content = self.generate_content.update_dockerfile()

            # Write the new content to the Dockerfile
            with open(dockerfile_path, 'w') as dockerfile:
                dockerfile.write(new_dockerfile_content)

            self.run_command.emit_log_output("Dockerfile updated successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while updating Dockerfile: {e}", 'ota-update')
            raise
        
    def update_docker_compose_file(self):
        """
        Updates the docker-compose.yml located in the working directory with the new content.
        """
        try:
            self.run_command.emit_log_output("Updating docker-compose.yml with new content...", 'ota-update')

            # Get the docker compose directory from TakServerStatus
            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockercompose_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockercompose_path):
                raise FileNotFoundError(f"docker-compose.yml not found at {dockercompose_path}")

            # Get the new docker-compose.yml content
            new_dockercompose_content = self.generate_content.update_docker_compose_file()

            # Write the new content to the docker-compose.yml
            with open(dockercompose_path, 'w') as dockercompose:
                dockercompose.write(new_dockercompose_content)

            self.run_command.emit_log_output("docker-compose.yml updated successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while updating docker-compose.yml: {e}", 'ota-update')
            raise

    def rebuild_takserver(self):
        try:
            self.run_command.emit_log_output("Running docker compose build and docker compose up...", 'ota-update')

            # Get the docker compose directory from TakServerStatus
            docker_compose_dir = self.tak_status.get_docker_compose_dir()
            dockerfile_path = os.path.join(docker_compose_dir, "docker", "Dockerfile.takserver")
            compose_file_path = os.path.join(docker_compose_dir, "docker-compose.yml")

            if not os.path.exists(dockerfile_path):
                raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

            if not os.path.exists(compose_file_path):
                raise FileNotFoundError(f"docker-compose.yml not found at {compose_file_path}")

            # Run docker compose build
            build_command = ['docker', 'compose', '-f', compose_file_path, 'build']
            self.run_command.run_command(build_command, namespace='ota-update', capture_output=False)

            # Run docker compose up with --force-recreate
            up_command = ['docker', 'compose', '-f', compose_file_path, 'up', '-d', '--force-recreate']
            self.run_command.run_command(up_command, namespace='ota-update', capture_output=False)

            self.run_command.emit_log_output("docker compose build and docker compose up executed successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while running docker compose: {e}", 'ota-update')
            raise

    def check_if_generate_inf_script_exists(self):
        try:
            script_path = '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            self.run_command.emit_log_output(f"Checking if script {script_path} already exists inside Docker container...", 'ota-update')

            # Get container name using TakServerStatus
            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            # Command to check if the script exists
            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-f', script_path
            ]
            result = self.run_command.run_command(check_command, namespace='ota-update', capture_output=True)

            if isinstance(result, subprocess.CompletedProcess):
                if result.returncode == 0:
                    self.run_command.emit_log_output(f"Script {script_path} already exists inside Docker container.", 'ota-update')
                    return True
                else:
                    self.run_command.emit_log_output(f"Script {script_path} does not exist inside Docker container.", 'ota-update')
                    return False
            else:
                self.run_command.emit_log_output(f"Unexpected result type: {type(result)}", 'ota-update')
                return False
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while checking if script exists: {e}", 'ota-update')
            raise

    def create_generate_inf_script(self):
        temp_script_path = None
        try:
            self.run_command.emit_log_output("Checking if generate-inf.sh script already exists...", 'ota-update')

            # Get container name using TakServerStatus
            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            # Check if the script already exists inside the Docker container
            script_exists = self.check_if_generate_inf_script_exists()
            if script_exists:
                self.run_command.emit_log_output("generate-inf.sh script already exists. Skipping creation.", 'ota-update')
                return

            self.run_command.emit_log_output("Creating generate-inf.sh script ...", 'ota-update')

            # Generate the script content
            generate_inf_script_content = self.generate_content.generate_inf_content()

            # Write the script content to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.sh') as temp_script_file:
                temp_script_file.write(generate_inf_script_content)
                temp_script_path = temp_script_file.name

            self.run_command.emit_log_output(f"Temporary script file created at {temp_script_path}", 'ota-update')

            # Copy the script into the Docker container
            copy_command = [
                'docker', 'cp', temp_script_path, f'{takserver_container_name}:/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(copy_command, namespace='ota-update', capture_output=False)

            # Run dos2unix and chmod commands inside the Docker container
            dos2unix_command = [
                'docker', 'exec', takserver_container_name, 'dos2unix', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            chmod_command = [
                'docker', 'exec', takserver_container_name, 'chmod', '+x', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh'
            ]
            self.run_command.run_command(dos2unix_command, namespace='ota-update', capture_output=False)
            self.run_command.run_command(chmod_command, namespace='ota-update', capture_output=False)

            self.run_command.emit_log_output("generate-inf.sh script created and prepared successfully inside Docker container.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while creating and preparing generate-inf.sh: {e}", 'ota-update')
            raise
        finally:
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)
                
    def check_and_remove_existing_plugin_folder(self):
        try:
            self.run_command.emit_log_output("Checking if plugins folder already exists inside Docker container...", 'ota-update')

            # Get container name using TakServerStatus
            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            # Command to check if the plugins folder exists
            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-d', '/opt/tak/webcontent/plugins'
            ]
            result = self.run_command.run_command(check_command, namespace='ota-update', capture_output=True)

            if result.returncode == 0:
                self.run_command.emit_log_output("Plugins folder exists. Removing it...", 'ota-update')

                # Command to remove the plugins folder
                remove_command = [
                    'docker', 'exec', takserver_container_name, 'rm', '-rf', '/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(remove_command, namespace='ota-update', capture_output=False)

                self.run_command.emit_log_output("Plugins folder removed successfully.", 'ota-update')
            else:
                self.run_command.emit_log_output("Plugins folder does not exist. No need to remove.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while checking/removing plugins folder: {e}", 'ota-update')
            raise

    def extract_and_prepare_plugins(self, ota_zip_path):
        try:
            self.run_command.emit_log_output("Extracting OTA zip file...", 'ota-update')

            # Create a temporary directory for extraction
            with tempfile.TemporaryDirectory() as temp_dir:
                # Extract the OTA zip file to the temporary directory
                with zipfile.ZipFile(ota_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                self.run_command.emit_log_output(f"Extracted OTA zip file to temporary directory: {temp_dir}", 'ota-update')

                # Ensure all files are in the root of the temporary directory
                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if root != temp_dir:
                            shutil.move(file_path, os.path.join(temp_dir, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))

                self.run_command.emit_log_output(f"All files moved to root of temporary directory: {temp_dir}", 'ota-update')

                # Get container name using TakServerStatus
                version = self.tak_status.get_takserver_version()
                takserver_container_name = f"takserver-{version}"

                # Copy the contents of the temporary directory into the Docker container
                copy_command = [
                    'docker', 'cp', f'{temp_dir}/.', f'{takserver_container_name}:/opt/tak/webcontent/plugins'
                ]
                self.run_command.run_command(copy_command, namespace='ota-update', capture_output=False)

                self.run_command.emit_log_output("Plugins copied to Docker container successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while extracting and preparing plugins: {e}", 'ota-update')
            raise

    def run_generate_inf_script(self):
        try:
            self.run_command.emit_log_output("Running generate-inf.sh script...", 'ota-update')

            # Get container name using TakServerStatus
            version = self.tak_status.get_takserver_version()
            takserver_container_name = f"takserver-{version}"

            # Command to run the generate-inf.sh script with the required arguments
            command = [
                'docker', 'exec', takserver_container_name, 'bash', '/opt/android-sdk/build-tools/33.0.0/generate-inf.sh', '/opt/tak/webcontent/plugins', 'true'
            ]
            self.run_command.run_command(command, namespace='ota-update', capture_output=False)

            self.run_command.emit_log_output("generate-inf.sh script executed successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while running generate-inf.sh: {e}", 'ota-update')
            raise

    def restart_takserver_containers(self):
        """Restart TAKServer containers using TakServerStatus"""
        try:
            self.run_command.emit_log_output("Restarting TAKServer containers...", 'ota-update')
            success = self.tak_status.restart_containers()
            if not success:
                raise Exception("Failed to restart TAKServer containers")
            self.run_command.emit_log_output("TAKServer containers restarted successfully.", 'ota-update')
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while restarting TAKServer containers: {e}", 'ota-update')
            raise

    def main(self):
        """Main OTA update process"""
        try:
            socketio.emit('installation_started', namespace='/ota-update')
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
            socketio.emit('installation_complete', {'status': 'success'}, namespace='/ota-update')
            return True
        except Exception as e:
            self.run_command.emit_log_output(f"Installation failed: {str(e)}", 'ota-update')
            socketio.emit('installation_failed', {'error': str(e)}, namespace='/ota-update')
            return False

    def update(self):
        """ OTA update process"""
        try:
            socketio.emit('ota_update_started', namespace='/ota-update')
            self.check_takserver_running()
            self.check_and_remove_existing_plugin_folder()
            self.extract_and_prepare_plugins(self.ota_zip_path)
            self.run_generate_inf_script()
            self.restart_takserver_containers()
            socketio.emit('ota_update_complete', {'status': 'success'}, namespace='/ota-update')
            return True
        except Exception as e:
            self.run_command.emit_log_output(f"OTA update failed: {str(e)}", 'ota-update')
            socketio.emit('ota_update_failed', {'error': str(e)}, namespace='/ota-update')
            return False
