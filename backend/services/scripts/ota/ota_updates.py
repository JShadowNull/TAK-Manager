import os
import tempfile
import eventlet
import shutil
import zipfile
from pathlib import Path
from eventlet.green import threading  # Use green threading
from backend.services.helpers.run_command import RunCommand
from backend.routes.socketio import socketio
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.ota.generate_content import GenerateOTAContent
from backend.services.helpers.os_detector import OSDetector
import subprocess

class OTAUpdate:
    def __init__(self, ota_zip_path):
        self.ota_zip_path = ota_zip_path  # Store the path to the OTA zip file
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.generate_content = GenerateOTAContent()
        self.stop_event = threading.Event()
        self.os_detector = OSDetector()
        self.completed_steps = []

    def check_stop(self):
        if self.stop_event.is_set():
            raise Exception("Configuration stopped by user.")
        
    def check_docker_running(self):
        """
        Checks if Docker is running and attempts to start it if not.
        Uses DockerManager's check_docker_status() method to determine Docker's status.
        """
        self.run_command.emit_log_output("Checking if Docker is running...", 'ota-update')
        self.check_stop()

        docker_status = self.docker_manager.check_docker_status()  # Use DockerManager's check method
        if docker_status:
            self.run_command.emit_log_output("Docker is running.", 'ota-update')
        else:
            self.run_command.emit_log_output("Docker is installed but not running. Attempting to start Docker...", 'ota-update')
            self.start_docker()

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

    def start_docker(self):
        """
        Attempt to start Docker based on the OS platform using DockerManager's start_docker method.
        """
        self.run_command.emit_log_output("Attempting to start Docker...", 'ota-update')
        self.check_stop()

        docker_start_result = self.docker_manager.start_docker()  # Use DockerManager's start_docker()

        # Handle the result of the start_docker method
        if 'error' in docker_start_result:
            self.run_command.emit_log_output(docker_start_result['error'], 'ota-update')
            raise SystemExit("Failed to start Docker. Please start it manually.")
        else:
            self.run_command.emit_log_output(docker_start_result['status'], 'ota-update')

        self.run_command.emit_log_output("Docker started successfully.", 'ota-update')
        
    def check_takserver_running(self):
        self.run_command.emit_log_output("Starting TAKServer and TAKServer-DB containers...", 'ota-update')

        # Read the version from version.txt
        version = self.read_version_txt()

        # Check if TAKServer and TAKServer-DB containers are running
        takserver_container_name = f"takserver-{version}"
        takserver_db_container_name = f"tak-database-{version}"

        check_takserver_command = ['docker', 'ps', '-q', '--filter', f"name=^{takserver_container_name}"]
        check_takserver_db_command = ['docker', 'ps', '-q', '--filter', f"name=^{takserver_db_container_name}"]

        takserver_running = self.run_command.run_command(check_takserver_command, namespace='ota-update', capture_output=True).stdout.strip()
        takserver_db_running = self.run_command.run_command(check_takserver_db_command, namespace='ota-update', capture_output=True).stdout.strip()

        if not takserver_running:
            self.run_command.emit_log_output(f"{takserver_container_name} is not running. Attempting to start it...", 'ota-update')
            start_takserver_command = ['docker', 'start', takserver_container_name]
            self.run_command.run_command(start_takserver_command, namespace='ota-update', capture_output=True)

        if not takserver_db_running:
            self.run_command.emit_log_output(f"{takserver_db_container_name} is not running. Attempting to start it...", 'ota-update')
            start_takserver_db_command = ['docker', 'start', takserver_db_container_name]
            self.run_command.run_command(start_takserver_db_command, namespace='ota-update', capture_output=True)

        self.run_command.emit_log_output("TAKServer containers started successfully. Waiting for containers to stabilize...", 'ota-update')

        # Wait for 8 seconds to allow containers to start
        eventlet.sleep(8)
        
    def read_version_txt(self):
        """
        Reads the version.txt file located in the OTA updates working directory and returns the version.
        """
        self.check_stop()
        working_dir = self.get_default_working_directory()
        version_file_path = os.path.join(working_dir, "version.txt")

        if not os.path.exists(version_file_path):
            raise FileNotFoundError(f"version.txt not found in {working_dir}")

        with open(version_file_path, 'r') as version_file:
            version = version_file.read().strip()

        self.run_command.emit_log_output(f"Read version: {version} from version.txt", 'ota-update')
        return version
    
    def get_default_working_directory(self):
        """Determine the default working directory based on the OS."""
        os_type = self.os_detector.detect_os()
        home_dir = str(Path.home())
        if os_type == 'windows' or os_type == 'macos':
            documents_dir = os.path.join(home_dir, 'Documents')
            # Ensure the Documents directory exists
            if not os.path.exists(documents_dir):
                os.makedirs(documents_dir)
            # Set the working directory to Documents/takserver-docker
            working_dir = os.path.join(documents_dir, 'takserver-docker')
        else:
            # For Linux, use the home directory directly
            working_dir = os.path.join(home_dir, 'takserver-docker')
        return working_dir
    
    def update_dockerfile(self):
        """
        Updates the Dockerfile located in the working directory with the new content.
        """
        try:
            self.run_command.emit_log_output("Updating Dockerfile with new content...", 'ota-update')

            # Read the version from version.txt
            version = self.read_version_txt()
            working_dir = self.get_default_working_directory()
            dockerfile_path = os.path.join(working_dir, f"takserver-docker-{version}", "docker", "Dockerfile.takserver")

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

            # Read the version from version.txt
            version = self.read_version_txt()
            working_dir = self.get_default_working_directory()
            dockercompose_path = os.path.join(working_dir, f"takserver-docker-{version}", "docker-compose.yml")

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

            # Read the version from version.txt
            version = self.read_version_txt()
            working_dir = self.get_default_working_directory()
            dockerfile_path = os.path.join(working_dir, f"takserver-docker-{version}", "docker", "Dockerfile.takserver")
            compose_file_path = os.path.join(working_dir, f"takserver-docker-{version}", "docker-compose.yml")

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

            # Read the version from version.txt
            version = self.read_version_txt()
            takserver_container_name = f"takserver-{version}"

            # Command to check if the script exists
            check_command = [
                'docker', 'exec', takserver_container_name, 'test', '-f', script_path
            ]
            result = self.run_command.run_command(check_command, namespace='ota-update', capture_output=True)

            # Check if the result is a CompletedProcess object or a boolean
            if isinstance(result, subprocess.CompletedProcess):
                if result.returncode == 0:
                    self.run_command.emit_log_output(f"Script {script_path} already exists inside Docker container.", 'ota-update')
                    return True
                else:
                    self.run_command.emit_log_output(f"Script {script_path} does not exist inside Docker container.", 'ota-update')
                    return False
            else:
                # Handle the case where result is a boolean
                self.run_command.emit_log_output(f"Unexpected result type: {type(result)}", 'ota-update')
                return False
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while checking if script exists: {e}", 'ota-update')
            raise

    def create_generate_inf_script(self):
        temp_script_path = None  # Initialize temp_script_path
        try:
            self.run_command.emit_log_output("Checking if generate-inf.sh script already exists...", 'ota-update')

            # Read the version from version.txt
            version = self.read_version_txt()
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

            # Copy the script into the Docker container named takserver-<version>
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
            # Clean up the temporary file
            if temp_script_path and os.path.exists(temp_script_path):
                os.remove(temp_script_path)
                
    def check_and_remove_existing_plugin_folder(self):
        try:
            self.run_command.emit_log_output("Checking if plugins folder already exists inside Docker container...", 'ota-update')

            # Read the version from version.txt
            version = self.read_version_txt()
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

                # Read the version from version.txt
                version = self.read_version_txt()
                takserver_container_name = f"takserver-{version}"

                # Copy the contents of the temporary directory into the Docker container under the plugins directory
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

            # Read the version from version.txt
            version = self.read_version_txt()
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
        try:
            self.run_command.emit_log_output("Restarting TAKServer and TAKServer-DB containers...", 'ota-update')

            # Read the version from version.txt
            version = self.read_version_txt()

            # Define container names
            takserver_container_name = f"takserver-{version}"
            takserver_db_container_name = f"tak-database-{version}"

            # Restart TAKServer-DB container first
            self.run_command.emit_log_output(f"Restarting {takserver_db_container_name} container...", 'ota-update')
            restart_takserver_db_command = ['docker', 'restart', takserver_db_container_name]
            self.run_command.run_command(restart_takserver_db_command, namespace='ota-update', capture_output=False)

            # Restart TAKServer container
            self.run_command.emit_log_output(f"Restarting {takserver_container_name} container...", 'ota-update')
            restart_takserver_command = ['docker', 'restart', takserver_container_name]
            self.run_command.run_command(restart_takserver_command, namespace='ota-update', capture_output=False)

            self.run_command.emit_log_output("TAKServer containers restarted successfully. Waiting for containers to stabilize...", 'ota-update')

            # Wait for 5 seconds to allow containers to restart
            eventlet.sleep(5)
        except Exception as e:
            self.run_command.emit_log_output(f"An error occurred while restarting TAKServer containers: {e}", 'ota-update')
            raise

    def main(self):
        """Main OTA update process"""
        try:
            socketio.emit('installation_started', namespace='/ota-update')
            self.install_rosetta_on_mac()
            self.check_docker_running()
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
            self.check_docker_running()
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
