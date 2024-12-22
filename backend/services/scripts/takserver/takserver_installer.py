# backend/services/scripts/takserver/takserver_installer.py

import eventlet  # Use eventlet for non-blocking sleep
import os
import shutil
from backend.services.helpers.run_command import RunCommand
import re
from backend.services.helpers.docker_installer import DockerInstaller
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.takserver.certconfig import CertConfig
from backend.services.helpers.os_detector import OSDetector  # Import the OSDetector class
from pathlib import Path
from eventlet.green import threading  # Use green threading
from backend.routes.socketio import socketio
from backend.services.scripts.docker.docker_checker import DockerChecker
from backend.services.helpers.operation_status import OperationStatus

class TakServerInstaller:
    def __init__(self, docker_zip_path, postgres_password, certificate_password, organization, state, city, organizational_unit, name):
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.docker_checker = DockerChecker()
        self.os_detector = OSDetector()
        self.working_dir = self.get_default_working_directory()
        self.docker_zip_path = docker_zip_path
        self.postgres_password = postgres_password
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.organizational_unit = organizational_unit
        self.name = name
        self.stop_event = threading.Event()
        self.completed_steps = []
        self.extracted_folder_name = None
        self.takserver_version = None
        self.operation_status = OperationStatus(namespace='/takserver-installer')
        self.cert_config = CertConfig(
            certificate_password=self.certificate_password,
            organization=self.organization,
            state=self.state,
            city=self.city,
            organizational_unit=self.organizational_unit,
            name=self.name,
            tak_dir=None  # Will be set later in unzip_docker_release
        )

    def check_stop(self):
        """Check if installation should be stopped and raise exception if so."""
        if self.stop_event.is_set():
            self.run_command.emit_log_output("Installation stop requested, initiating rollback...", 'takserver-installer')
            raise Exception("Installation stopped by user.")

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

    def check_docker_running(self):
        """Check if Docker is running using DockerChecker."""
        self.run_command.emit_log_output("Checking if Docker is running...", 'takserver-installer')
        self.check_stop()

        docker_status = self.docker_checker.get_status()
        if not docker_status['isRunning']:
            error_message = docker_status.get('error', 'Docker is not running')
            self.run_command.emit_log_output(error_message, 'takserver-installer')
            raise SystemExit(error_message)

        self.run_command.emit_log_output("Docker is running.", 'takserver-installer')
        return True

    def start_docker(self):
        """
        Attempt to start Docker based on the OS platform using DockerManager's start_docker method.
        """
        self.run_command.emit_log_output("Attempting to start Docker...", 'takserver-installer')
        self.check_stop()

        docker_start_result = self.docker_manager.start_docker()  # Use DockerManager's start_docker()

        # Handle the result of the start_docker method
        if 'error' in docker_start_result:
            self.run_command.emit_log_output(docker_start_result['error'], 'takserver-installer')
            raise SystemExit("Failed to start Docker. Please start it manually.")
        else:
            self.run_command.emit_log_output(docker_start_result['status'], 'takserver-installer')

        self.run_command.emit_log_output("Docker started successfully.", 'takserver-installer')

    def create_working_directory(self):
        """Create the working directory, removing it first if it exists."""
        self.check_stop()
        
        # If directory exists, remove it
        if os.path.exists(self.working_dir):
            try:
                self.run_command.emit_log_output(f"Removing existing directory: {self.working_dir}", 'takserver-installer')
                shutil.rmtree(self.working_dir)
                self.run_command.emit_log_output(f"Successfully removed existing directory", 'takserver-installer')
            except Exception as e:
                error_message = f"Failed to remove existing directory: {str(e)}"
                self.run_command.emit_log_output(error_message, 'takserver-installer')
                socketio.emit('installation_failed', {'error': error_message}, namespace='/takserver-installer')
                raise SystemExit(error_message)

        try:
            os.makedirs(self.working_dir)
            self.run_command.emit_log_output(f"Created directory: {self.working_dir}", 'takserver-installer')
            self.completed_steps.append('create_working_directory')
        except Exception as e:
            error_message = f"Failed to create directory: {str(e)}"
            self.run_command.emit_log_output(error_message, 'takserver-installer')
            socketio.emit('installation_failed', {'error': error_message}, namespace='/takserver-installer')
            raise SystemExit(error_message)

    def unzip_docker_release(self):
        self.check_stop()
        if os.path.exists(self.docker_zip_path):
            zip_filename = os.path.basename(self.docker_zip_path)
            match = re.search(r'takserver-docker-(.+)\.zip', zip_filename)
            if match:
                self.takserver_version = match.group(1).lower()
                self.run_command.emit_log_output(f"TAKServer version: {self.takserver_version}", 'takserver-installer')
            else:
                raise ValueError("Failed to extract version from the zip filename.")

            self.zip_filename = zip_filename  # Store as instance variable
            destination_zip_path = os.path.join(self.working_dir, zip_filename)

            if self.docker_zip_path == destination_zip_path:
                self.run_command.emit_log_output(f"Source and destination are the same: {self.docker_zip_path}. Skipping copy.", 'takserver-installer')
            else:
                shutil.copy(self.docker_zip_path, self.working_dir)
                self.run_command.emit_log_output(f"Copied {self.docker_zip_path} to {self.working_dir}", 'takserver-installer')

            # Use OS detection to adjust unzip command if necessary
            os_type = self.os_detector.detect_os()  # Detect the OS
            os.chdir(self.working_dir)  # Change to working directory

            self.check_stop()

            if os_type == 'windows':
                # Use PowerShell's Expand-Archive command on Windows
                unzip_command = ["powershell", "-Command", f"Expand-Archive -Path '{zip_filename}' -DestinationPath '{self.working_dir}'"]
                self.run_command.run_command_no_output(unzip_command, working_dir=self.working_dir)
            else:
                # For macOS and Linux, use the standard unzip command
                self.run_command.run_command_no_output(["unzip", zip_filename], working_dir=self.working_dir)

            self.run_command.emit_log_output(f"Unzipped {self.docker_zip_path} to {self.working_dir}", 'takserver-installer')

            self.extracted_folder_name = zip_filename.replace(".zip", "")
            self.tak_dir = os.path.join(self.working_dir, self.extracted_folder_name, "tak")

            if os.path.exists(self.tak_dir):
                self.run_command.emit_log_output(f"TAK directory set to: {self.tak_dir}", 'takserver-installer')
                self.completed_steps.append('unzip_docker_release')
                self.cert_config.update_tak_dir(self.tak_dir)

                # Create version.txt in the working directory
                version_file_path = os.path.join(self.working_dir, "version.txt")
                with open(version_file_path, "w") as version_file:
                    version_file.write(self.takserver_version)
                self.run_command.emit_log_output(f"Created version.txt with version {self.takserver_version} in {self.working_dir}", 'takserver-installer')

            else:
                raise ValueError(f"TAK directory not found at expected path: {self.tak_dir}")
        else:
            self.run_command.emit_log_output(f"{self.docker_zip_path} not found. Ensure the file is in the specified location.", 'takserver-installer')

    def copy_coreconfig(self):
        """Copy CoreConfig.xml from the example file."""
        self.check_stop()
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")
        example_core_config = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if not os.path.exists(core_config_path):
            if os.path.exists(example_core_config):
                shutil.copy(example_core_config, core_config_path)
                self.run_command.emit_log_output("Copied CoreConfig.example.xml to CoreConfig.xml", 'takserver-installer')
                self.completed_steps.append('copy_coreconfig')
            else:
                self.run_command.emit_log_output(f"Error: Example CoreConfig file not found at {example_core_config}.", 'takserver-installer')
        else:
            self.run_command.emit_log_output("CoreConfig.xml already exists.", 'takserver-installer')

    def update_coreconfig_password(self):
        """Update the database password in CoreConfig.xml."""
        self.check_stop()
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if os.path.exists(core_config_path):
            os_type = self.os_detector.detect_os()  # Detect the OS

            self.run_command.emit_log_output("Updating database password in CoreConfig.example.xml...", 'takserver-installer')

            if os_type == 'macos':
                sed_command_password = f"sed -i '' 's|password=\"[^\"]*\"|password=\"{self.postgres_password}\"|g' \"{core_config_path}\""
            elif os_type == 'linux':
                sed_command_password = f"sed -i 's|password=\"[^\"]*\"|password=\"{self.postgres_password}\"|g' \"{core_config_path}\""
            elif os_type == 'windows':
                powershell_command_password = f"(Get-Content '{core_config_path}').replace('password=\"\"', 'password=\"{self.postgres_password}\"') | Set-Content '{core_config_path}'"
                self.run_command.run_command_no_output(["powershell", "-Command", powershell_command_password])
                self.run_command.emit_log_output("Updated CoreConfig.example.xml password on Windows.", 'takserver-installer')
                self.completed_steps.append('update_coreconfig_password')
                return
            else:
                self.run_command.emit_log_output("Unsupported OS for updating CoreConfig.xml", 'takserver-installer')
                raise SystemExit("Unsupported OS")

            # Run the sed command on macOS/Linux
            self.run_command.run_command_no_output(sed_command_password, shell=True)
            self.run_command.emit_log_output("Updated CoreConfig.xml password.", 'takserver-installer')
            self.completed_steps.append('update_coreconfig_password')
        else:
            self.run_command.emit_log_output(f"CoreConfig.xml not found at {core_config_path}.", 'takserver-installer')

    def modify_coreconfig_with_sed_on_host(self):
        self.check_stop()

        # Set the path to CoreConfig.example.xml
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if not os.path.exists(core_config_path):
            self.run_command.emit_log_output(f"CoreConfig.example.xml not found at {core_config_path}.", 'takserver-installer')
            return

        os_type = self.os_detector.detect_os()  # Detect the OS

        self.run_command.emit_log_output("Modifying CoreConfig.example.xml for certificate enrollment...", 'takserver-installer')

        # sed command for modifying the CoreConfig.example.xml
        sed_command = f'''sed -i '/<security>/,/<\\/security>/c \\
        <certificateSigning CA="TAKServer">\\n    <certificateConfig>\\n        <nameEntries>\\n            <nameEntry name="O" value="TAK"/>\\n            <nameEntry name="OU" value="TAK"/>\\n        </nameEntries>\\n    </certificateConfig>\\n    <TAKServerCAConfig keystore="JKS" keystoreFile="certs/files/intermediate-signing.jks" keystorePass="{self.certificate_password}" validityDays="30" signatureAlg="SHA256WithRSA"/>\\n</certificateSigning>\\n\\
        <security>\\n    <tls keystore="JKS" keystoreFile="certs/files/takserver.jks" keystorePass="{self.certificate_password}" truststore="JKS" truststoreFile="certs/files/truststore-intermediate.jks" truststorePass="{self.certificate_password}" context="TLSv1.2" keymanager="SunX509"/>\\n</security>' "{core_config_path}"'''

        # Adjust the sed command based on OS
        if os_type == 'macos':
            sed_command = f"sed -i '' '/<security>/,/<\\/security>/c \\\n<certificateSigning CA=\"TAKServer\">\\\n    <certificateConfig>\\\n        <nameEntries>\\\n            <nameEntry name=\"O\" value=\"TAK\"/>\\\n            <nameEntry name=\"OU\" value=\"TAK\"/>\\\n        </nameEntries>\\\n    </certificateConfig>\\\n    <TAKServerCAConfig keystore=\"JKS\" keystoreFile=\"certs/files/intermediate-signing.jks\" keystorePass=\"{self.certificate_password}\" validityDays=\"30\" signatureAlg=\"SHA256WithRSA\"/>\\\n</certificateSigning>\\\n<security>\\\n    <tls keystore=\"JKS\" keystoreFile=\"certs/files/takserver.jks\" keystorePass=\"{self.certificate_password}\" truststore=\"JKS\" truststoreFile=\"certs/files/truststore-intermediate.jks\" truststorePass=\"{self.certificate_password}\" context=\"TLSv1.2\" keymanager=\"SunX509\"/>\\\n</security>' {core_config_path}"
        elif os_type == 'linux':
            sed_command = f"sed -i '/<security>/,/<\\/security>/c \\\n<certificateSigning CA=\"TAKServer\">\\\n    <certificateConfig>\\\n        <nameEntries>\\\n            <nameEntry name=\"O\" value=\"TAK\"/>\\\n            <nameEntry name=\"OU\" value=\"TAK\"/>\\\n        </nameEntries>\\\n    </certificateConfig>\\\n    <TAKServerCAConfig keystore=\"JKS\" keystoreFile=\"certs/files/intermediate-signing.jks\" keystorePass=\"{self.certificate_password}\" validityDays=\"30\" signatureAlg=\"SHA256WithRSA\"/>\\\n</certificateSigning>\\\n<security>\\\n    <tls keystore=\"JKS\" keystoreFile=\"certs/files/takserver.jks\" keystorePass=\"{self.certificate_password}\" truststore=\"JKS\" truststoreFile=\"certs/files/truststore-intermediate.jks\" truststorePass=\"{self.certificate_password}\" context=\"TLSv1.2\" keymanager=\"SunX509\"/>\\\n</security>' {core_config_path}"
        elif os_type == 'windows':
            # Using PowerShell to replace in Windows
            powershell_sed_command = f"(Get-Content '{core_config_path}').replace('<security>', '{sed_command}') | Set-Content '{core_config_path}'"
            self.run_command.run_command_no_output(["powershell", "-Command", powershell_sed_command])
            self.run_command.emit_log_output("Modified CoreConfig.example.xml for certificate enrollment on Windows.", 'takserver-installer')
            return
        else:
            self.run_command.emit_log_output(f"Unsupported OS: {os_type}. Cannot modify CoreConfig.example.xml.", 'takserver-installer')
            raise SystemExit(f"Unsupported OS: {os_type}")

        # Execute sed command for macOS/Linux
        self.run_command.run_command_no_output(sed_command, shell=True)
        self.run_command.emit_log_output("CoreConfig.example.xml modified successfully on the host.", 'takserver-installer')

        # Format the XML using xmllint
        self.run_command.emit_log_output("Now formatting CoreConfig.example.xml...", 'takserver-installer')

        # Install libxml2-utils for xmllint on Linux/macOS if not present
        install_libxml2_command = "apt-get update && apt-get install -y libxml2-utils" if os_type == 'linux' else "brew install libxml2"
        xmllint_command = f"xmllint --format {core_config_path} -o {core_config_path}"

        if os_type in ['linux', 'macos']:
            self.run_command.run_command_no_output(install_libxml2_command, shell=True)
            self.run_command.run_command_no_output(xmllint_command, shell=True)
            self.run_command.emit_log_output("CoreConfig.example.xml formatted successfully on macOS/Linux.", 'takserver-installer')
        else:
            self.run_command.emit_log_output("Skipping XML formatting on Windows.", 'takserver-installer')


    def create_docker_compose_file(self):
        """Create the Docker Compose file for the TAK server."""
        self.check_stop()
        docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
        docker_compose_content = f"""
services:
  takserver-db:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver-db
    container_name: tak-database-{self.takserver_version}
    hostname: tak-database
    init: true
    networks:
      - net
    ports:
      - 5432:5432
    restart: unless-stopped
    tty: true
    volumes:
      - ./tak:/opt/tak:z
      - db-data:/var/lib/postgresql/data

  takserver:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver
    container_name: takserver-{self.takserver_version}
    hostname: takserver
    init: true
    networks:
      - net
    ports:
      - 8443:8443
      - 8446:8446
      - 8089:8089
      - 8444:8444
    restart: unless-stopped
    tty: true
    volumes:
      - ./tak:/opt/tak:z
      - ./plugins:/opt/tak/webcontent:z

networks:
  net:
    name: 'takserver'
    ipam:
      driver: default
      config:
        - subnet: 172.16.16.0/24

volumes:
  db-data:  # Named volume for database persistence
"""

        with open(docker_compose_path, "w") as file:
            file.write(docker_compose_content)
        self.run_command.emit_log_output(f"Created docker-compose.yml file at {docker_compose_path}.", 'takserver-installer')
        self.completed_steps.append('create_docker_compose_file')

    def start_docker_compose(self):
        """Start Docker Compose services."""
        self.check_stop()
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        # Step 1: Start Docker Compose services
        self.run_command.run_command(
            ["docker-compose", "up", "-d"],
            working_dir=docker_compose_dir,
            namespace='takserver-installer'
        )
        self.completed_steps.append('start_docker_compose')

        # Step 2: Log that Docker Compose services have started
        self.run_command.emit_log_output("Started Docker Compose services.", 'takserver-installer')

        # Step 3: Wait 30 seconds to ensure containers are fully started
        self.run_command.emit_log_output("Waiting for containers to fully start (30 seconds)...", 'takserver-installer')
        eventlet.sleep(30)  # Use eventlet's cooperative sleep for the wait

    def verify_containers(self):
        """Verify that the containers are running."""
        self.check_stop()
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command_no_output(["docker-compose", "ps"], working_dir=docker_compose_dir)
        self.run_command.emit_log_output("TAKServer containers started.", 'takserver-installer')

    def restart_takserver(self):
        """Restart TAKServer and TAKServer database."""
        self.check_stop()
        self.run_command.emit_log_output("Restarting TAKServer and TAKServer database...", 'takserver-installer')
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command_no_output(
            ["docker-compose", "restart"],
            working_dir=docker_compose_dir
        )
        # No need to add to completed_steps since we are not rolling back restarts

    def rollback_takserver_installation(self):
        """Rollback TAK Server installation if something goes wrong."""
        self.run_command.emit_log_output("Starting rollback of TAKServer installation...", 'takserver-installer')
        self.operation_status.start_operation('rollback', message="Starting rollback of TAKServer installation", details={'progress': 0})

        try:
            # Check if docker-compose.yml exists
            docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
            if os.path.exists(docker_compose_path):
                docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
                self.run_command.emit_log_output("Found docker-compose.yml, cleaning up containers, images, and volumes...", 'takserver-installer')
                self.operation_status.update_progress('rollback', 20, "Starting Docker cleanup")
                
                try:
                    # Use docker-compose down with flags to remove everything
                    self.run_command.run_command(
                        ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                        working_dir=docker_compose_dir,
                        namespace='takserver-installer',
                        capture_output=True,
                        emit_output=True
                    )
                    self.operation_status.update_progress('rollback', 40, "Removed Docker containers and images")
                    
                    # Clean up BuildKit resources
                    self.run_command.emit_log_output("Cleaning up BuildKit resources...", 'takserver-installer')
                    self.operation_status.update_progress('rollback', 60, "Cleaning BuildKit resources")
                    
                    # Get and remove BuildKit containers
                    buildkit_containers = [container_id for container_id in self.run_command.run_command(
                        ["docker", "ps", "-a", "--filter", "ancestor=moby/buildkit:buildx-stable-1", "--format", "{{.ID}}"],
                        namespace='takserver-installer',
                        capture_output=True,
                        emit_output=True
                    ).stdout.strip().split('\n') if container_id]
                    
                    if buildkit_containers:
                        self.run_command.run_command(
                            ["docker", "rm", "-f"] + buildkit_containers,
                            namespace='takserver-installer',
                            capture_output=True,
                            emit_output=True
                        )
                        self.run_command.emit_log_output("BuildKit containers cleaned up", 'takserver-installer')
                    
                    # Get and remove BuildKit volumes
                    buildkit_volumes = [volume_id for volume_id in self.run_command.run_command(
                        ["docker", "volume", "ls", "--filter", "name=buildkit", "--quiet"],
                        namespace='takserver-installer',
                        capture_output=True,
                        emit_output=True
                    ).stdout.strip().split('\n') if volume_id]
                    
                    if buildkit_volumes:
                        self.run_command.run_command(
                            ["docker", "volume", "rm", "-f"] + buildkit_volumes,
                            namespace='takserver-installer',
                            capture_output=True,
                            emit_output=True
                        )
                        self.run_command.emit_log_output("BuildKit volumes cleaned up", 'takserver-installer')
                    
                    # Remove BuildKit image
                    self.run_command.run_command(
                        ["docker", "rmi", "-f", "moby/buildkit:buildx-stable-1"],
                        namespace='takserver-installer',
                        capture_output=True,
                        emit_output=True
                    )
                    self.run_command.emit_log_output("BuildKit image removed", 'takserver-installer')
                    self.operation_status.update_progress('rollback', 80, "BuildKit cleanup completed")
                    
                except Exception as e:
                    self.run_command.emit_log_output(f"Warning during docker-compose cleanup: {str(e)}", 'takserver-installer')
            else:
                self.run_command.emit_log_output("No docker-compose.yml found, skipping container/image/volume cleanup", 'takserver-installer')
                self.operation_status.update_progress('rollback', 80, "No Docker cleanup needed")

            # Remove the working directory if it exists
            if os.path.exists(self.working_dir):
                try:
                    self.run_command.emit_log_output(f"Removing working directory: {self.working_dir}", 'takserver-installer')
                    self.operation_status.update_progress('rollback', 90, "Removing installation files")
                    shutil.rmtree(self.working_dir)
                    self.run_command.emit_log_output("Removed working directory", 'takserver-installer')
                except Exception as e:
                    self.run_command.emit_log_output(f"Error removing working directory: {str(e)}", 'takserver-installer')

            self.run_command.emit_log_output("Rollback completed successfully", 'takserver-installer')
            self.operation_status.complete_operation('rollback', message="Rollback completed successfully", details={'progress': 100})

        except Exception as e:
            error_message = f"Error during rollback: {str(e)}"
            self.run_command.emit_log_output(error_message, 'takserver-installer')
            self.operation_status.fail_operation('rollback', error_message, details={'progress': 0})
            raise

    def main(self):
        try:
            # Start installation operation
            self.operation_status.start_operation('installation', message="Starting TAK Server installation", details={'progress': 0})

            # Check Docker status first (5%)
            docker_status = self.docker_checker.get_status()
            if not docker_status['isInstalled']:
                self.operation_status.fail_operation('installation', "Docker is not installed")
                raise SystemExit("Docker is not installed")
            if not docker_status['isRunning']:
                self.start_docker()
            self.operation_status.update_progress('installation', 5, "Docker environment checked")

            # Extract version from zip filename (10%)
            zip_filename = os.path.basename(self.docker_zip_path)
            match = re.search(r'takserver-docker-(.+)\.zip', zip_filename)
            if not match:
                raise ValueError("Invalid TAK Server ZIP filename format")
            self.takserver_version = match.group(1)
            self.operation_status.update_progress('installation', 10, "Version extracted from ZIP file")

            # Initial setup phase (25%)
            self.create_working_directory()
            self.operation_status.update_progress('installation', 15, "Working directory created")
            
            self.unzip_docker_release()
            self.operation_status.update_progress('installation', 25, "Docker release files extracted")

            # Configuration phase (50%)
            self.update_coreconfig_password()
            self.operation_status.update_progress('installation', 35, "Core configuration password updated")
            
            self.modify_coreconfig_with_sed_on_host()
            self.operation_status.update_progress('installation', 40, "Core configuration modified")
            
            self.copy_coreconfig()
            self.operation_status.update_progress('installation', 45, "Core configuration copied")
            
            self.create_docker_compose_file()
            self.operation_status.update_progress('installation', 50, "Docker compose file created")

            # Container deployment phase (75%)
            self.start_docker_compose()
            self.operation_status.update_progress('installation', 65, "Docker containers starting")
            
            self.verify_containers()
            self.operation_status.update_progress('installation', 75, "Docker containers verified")

            # Save version information
            version_file_path = os.path.join(self.working_dir, "version.txt")
            with open(version_file_path, "w") as version_file:
                version_file.write(self.takserver_version)
            self.operation_status.update_progress('installation', 80, "Version information saved")

            # Certificate configuration phase (100%)
            takserver_name = f"takserver-{self.takserver_version}"
            self.cert_config.configure_cert_metadata(takserver_name, check_stop=self.check_stop)
            self.operation_status.update_progress('installation', 85, "Certificate metadata configured")
            
            self.cert_config.certificate_generation(takserver_name, check_stop=self.check_stop)
            self.operation_status.update_progress('installation', 90, "Certificates generated")
            
            self.restart_takserver()
            self.operation_status.update_progress('installation', 95, "TAK Server restarted")
            
            self.cert_config.run_certmod(takserver_name, check_stop=self.check_stop)
            self.cert_config.install_admin_cert_to_keychain(check_stop=self.check_stop)
            self.completed_steps.append('install_admin_cert_to_keychain')
            self.operation_status.update_progress('installation', 98, "Certificates installed")

            # Complete installation
            self.operation_status.complete_operation(
                'installation',
                message="TAK Server installation completed successfully",
                details={
                    'version': self.takserver_version,
                    'isInstalled': True,
                    'isRunning': True,
                    'progress': 100
                }
            )
            return True

        except Exception as e:
            error_message = str(e)
            self.run_command.emit_log_output(f"Installation failed: {error_message}", 'takserver-installer')
            self.operation_status.fail_operation('installation', error_message, details={'progress': 0})
            self.rollback_takserver_installation()
            raise


