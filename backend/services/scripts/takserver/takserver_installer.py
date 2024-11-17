# backend/services/scripts/takserver_installer.py

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

class TakServerInstaller:
    def __init__(self, docker_zip_path, postgres_password, certificate_password, organization, state, city, organizational_unit, name):
        self.run_command = RunCommand()
        self.docker_installer = DockerInstaller()
        self.docker_manager = DockerManager()
        self.cert_config = CertConfig(certificate_password, organization, state, city, organizational_unit, name, tak_dir=None)
        self.os_detector = OSDetector()  # Initialize OSDetector
        self.completed_steps = []  # Track completed steps for rollback

        # Set working directory to predetermined path in Documents/takserver-docker
        self.working_dir = self.get_default_working_directory()
        self.run_command.emit_log_output(f"Set working directory to: {self.working_dir}", 'takserver-installer')

        self.docker_zip = docker_zip_path
        self.postgres_password = postgres_password
        self.takserver_version = None
        self.tak_dir = None
        self.certificate_password = certificate_password

        # Add a stop event to allow the installation to be interrupted
        self.stop_event = threading.Event()

    def check_stop(self):
        if self.stop_event.is_set():
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
        """
        Checks if Docker is running and attempts to start it if not.
        Uses DockerManager's check_docker_status() method to determine Docker's status.
        """
        self.run_command.emit_log_output("Checking if Docker is running...", 'takserver-installer')
        self.check_stop()

        docker_status = self.docker_manager.check_docker_status()  # Use DockerManager's check method
        if docker_status:
            self.run_command.emit_log_output("Docker is running.", 'takserver-installer')
        else:
            self.run_command.emit_log_output("Docker is installed but not running. Attempting to start Docker...", 'takserver-installer')
            self.start_docker()

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
        """Create the working directory if it does not exist."""
        self.check_stop()
        if not os.path.exists(self.working_dir):
            os.makedirs(self.working_dir)
            self.run_command.emit_log_output(f"Created directory: {self.working_dir}", 'takserver-installer')
            self.completed_steps.append('create_working_directory')
        else:
            error_message = f"Directory already exists: {self.working_dir}."
            socketio.emit('installation_failed', {'error': error_message}, namespace='/takserver-installer')
            raise SystemExit(error_message)

    def unzip_docker_release(self):
        self.check_stop()
        if os.path.exists(self.docker_zip):
            zip_filename = os.path.basename(self.docker_zip)
            match = re.search(r'takserver-docker-(.+)\.zip', zip_filename)
            if match:
                self.takserver_version = match.group(1).lower()
                self.run_command.emit_log_output(f"TAKServer version: {self.takserver_version}", 'takserver-installer')
            else:
                raise ValueError("Failed to extract version from the zip filename.")

            self.zip_filename = zip_filename  # Store as instance variable
            destination_zip_path = os.path.join(self.working_dir, zip_filename)

            if self.docker_zip == destination_zip_path:
                self.run_command.emit_log_output(f"Source and destination are the same: {self.docker_zip}. Skipping copy.", 'takserver-installer')
            else:
                shutil.copy(self.docker_zip, self.working_dir)
                self.run_command.emit_log_output(f"Copied {self.docker_zip} to {self.working_dir}", 'takserver-installer')

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

            self.run_command.emit_log_output(f"Unzipped {self.docker_zip} to {self.working_dir}", 'takserver-installer')

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
            self.run_command.emit_log_output(f"{self.docker_zip} not found. Ensure the file is in the specified location.", 'takserver-installer')

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
      - db-data:/var/lib/postgresql/data:z 

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
  db-data:  # Declaring the named volume for takserver-db
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
        """
        Rolls back the TAKServer installation based on the completed steps.
        Handles necessary actions: stopping Docker Compose services if started,
        deleting the working directory, and removing admin certificate from the keychain if added.
        """
        try:
            socketio.emit('rollback_started', namespace='/takserver-installer')  # Add this line
            self.run_command.emit_log_output("Starting rollback of TAKServer installation...", 'takserver-installer')

            docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)

            # Check if docker-compose was started
            if 'start_docker_compose' in self.completed_steps:
                if os.path.exists(docker_compose_dir):
                    self.run_command.emit_log_output("Stopping Docker Compose services...", 'takserver-installer')
                    self.run_command.run_command(
                        ["docker-compose", "down"],
                        working_dir=docker_compose_dir,
                        namespace='takserver-installer'
                    )
                    self.completed_steps.remove('start_docker_compose')  # Remove from steps after rollback

            # Remove the admin certificate from Keychain if it was installed
            if 'install_admin_cert_to_keychain' in self.completed_steps:
                self.run_command.emit_log_output("Removing admin certificate from Keychain...", 'takserver-installer')
                self.cert_config.remove_admin_cert_from_keychain()
                self.completed_steps.remove('install_admin_cert_to_keychain')

            # Check if the working directory was created
            if 'create_working_directory' in self.completed_steps:
                if os.path.exists(self.working_dir):
                    self.run_command.emit_log_output("Removing working directory and all its contents...", 'takserver-installer')
                    shutil.rmtree(self.working_dir)
                    self.completed_steps.remove('create_working_directory')  # Remove from steps after rollback

            self.run_command.emit_log_output("Rollback completed.", 'takserver-installer')
            socketio.emit('rollback_complete', {'status': 'success'}, namespace='/takserver-installer')

        except Exception as e:
            self.run_command.emit_log_output(f"Error during rollback: {str(e)}", 'takserver-installer')
            socketio.emit('rollback_failed', {'error': str(e)}, namespace='/takserver-installer')

    def main(self):
        try:
            socketio.emit('installation_started', namespace='/takserver-installer')
            self.check_docker_running()
            self.create_working_directory()
            self.unzip_docker_release()
            self.update_coreconfig_password()
            self.modify_coreconfig_with_sed_on_host()
            self.copy_coreconfig()
            self.create_docker_compose_file()
            self.start_docker_compose()
            self.verify_containers()

            takserver_name = f"takserver-{self.takserver_version}"

            self.cert_config.configure_cert_metadata(takserver_name, check_stop=self.check_stop)
            self.cert_config.certificate_generation(takserver_name, check_stop=self.check_stop)
            self.restart_takserver()
            self.cert_config.run_certmod(takserver_name, check_stop=self.check_stop)
            self.cert_config.install_admin_cert_to_keychain(check_stop=self.check_stop)
            self.completed_steps.append('install_admin_cert_to_keychain')

            self.run_command.emit_log_output("TAKServer installation completed successfully.", 'takserver-installer')
            socketio.emit('installation_complete', {'status': 'success'}, namespace='/takserver-installer')

        except Exception as e:
            self.run_command.emit_log_output(f"Installation failed: {str(e)}", 'takserver-installer')
            socketio.emit('installation_failed', {'error': str(e)}, namespace='/takserver-installer')
            self.rollback_takserver_installation()
            raise  # Re-raise the exception to halt execution


