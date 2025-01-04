# backend/services/scripts/takserver/takserver_installer.py

import eventlet  # Use eventlet for non-blocking sleep
import os
import shutil
from backend.services.helpers.run_command import RunCommand
import re
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.takserver.certconfig import CertConfig
from pathlib import Path
from backend.routes.socketio import socketio
from backend.services.helpers.operation_status import OperationStatus

class TakServerInstaller:
    def __init__(self, docker_zip_path, postgres_password, certificate_password, organization, state, city, organizational_unit, name):
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.working_dir = self.get_default_working_directory()
        self.docker_zip_path = docker_zip_path
        self.postgres_password = postgres_password
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.organizational_unit = organizational_unit
        self.name = name
        self.completed_steps = []
        self.extracted_folder_name = None
        self.takserver_version = None
        self.installation_progress = 0
        self.cert_config = CertConfig(
            certificate_password=self.certificate_password,
            organization=self.organization,
            state=self.state,
            city=self.city,
            organizational_unit=self.organizational_unit,
            name=self.name,
            tak_dir=None,  # Will be set later in unzip_docker_release
            working_dir=self.working_dir
        )

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver-docker')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
        return working_dir

    def create_working_directory(self):
        """Create the working directory, removing it first if it exists."""
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
            self.cert_config.update_working_dir(self.working_dir)  # Update working_dir in cert_config
            self.completed_steps.append('create_working_directory')
        except Exception as e:
            error_message = f"Failed to create directory: {str(e)}"
            self.run_command.emit_log_output(error_message, 'takserver-installer')
            socketio.emit('installation_failed', {'error': error_message}, namespace='/takserver-installer')
            raise SystemExit(error_message)

    def unzip_docker_release(self):
        if os.path.exists(self.docker_zip_path):
            zip_filename = os.path.basename(self.docker_zip_path)
            match = re.search(r'takserver-docker-(.+)\.zip', zip_filename)
            if match:
                self.takserver_version = match.group(1).lower()
                self.run_command.emit_log_output(f"TAKServer version: {self.takserver_version}", 'takserver-installer')
            else:
                raise ValueError("Failed to extract version from the zip filename.")

            self.zip_filename = zip_filename

            # Extract directly to working directory
            self.run_command.run_command_no_output(["unzip", self.docker_zip_path, "-d", self.working_dir])
            self.run_command.emit_log_output(f"Unzipped {self.docker_zip_path} to {self.working_dir}", 'takserver-installer')

            # Set paths after extraction
            self.extracted_folder_name = zip_filename.replace(".zip", "")
            self.tak_dir = os.path.join(self.working_dir, self.extracted_folder_name, "tak")

            if os.path.exists(self.tak_dir):
                self.run_command.emit_log_output(f"TAK directory set to: {self.tak_dir}", 'takserver-installer')
                self.completed_steps.append('unzip_docker_release')
                self.cert_config.update_tak_dir(self.tak_dir)

                version_file_path = os.path.join(self.working_dir, "version.txt")
                with open(version_file_path, "w") as version_file:
                    version_file.write(f"{self.takserver_version}\n")
                self.run_command.emit_log_output(f"Created version.txt with version {self.takserver_version} in {self.working_dir}", 'takserver-installer')
            else:
                raise ValueError(f"TAK directory not found at expected path: {self.tak_dir}")
        else:
            self.run_command.emit_log_output(f"{self.docker_zip_path} not found. Ensure the file is in the specified location.", 'takserver-installer')

    def copy_coreconfig(self):
        """Copy CoreConfig.xml from the example file."""
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
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if os.path.exists(core_config_path):
            self.run_command.emit_log_output("Updating database password in CoreConfig.example.xml...", 'takserver-installer')
            
            # Use sed command in container environment
            sed_command = f"sed -i 's|password=\"[^\"]*\"|password=\"{self.postgres_password}\"|g' \"{core_config_path}\""
            self.run_command.run_command_no_output(sed_command, shell=True)
            
            self.run_command.emit_log_output("Updated CoreConfig.xml password.", 'takserver-installer')
            self.completed_steps.append('update_coreconfig_password')
        else:
            self.run_command.emit_log_output(f"CoreConfig.xml not found at {core_config_path}.", 'takserver-installer')

    def modify_coreconfig_with_sed_on_host(self):
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if not os.path.exists(core_config_path):
            self.run_command.emit_log_output(f"CoreConfig.example.xml not found at {core_config_path}.", 'takserver-installer')
            return

        self.run_command.emit_log_output("Modifying CoreConfig.example.xml for certificate enrollment...", 'takserver-installer')

        # Simplified sed command for container environment
        sed_command = f"sed -i '/<security>/,/<\\/security>/c \\\n<certificateSigning CA=\"TAKServer\">\\\n    <certificateConfig>\\\n        <nameEntries>\\\n            <nameEntry name=\"O\" value=\"TAK\"/>\\\n            <nameEntry name=\"OU\" value=\"TAK\"/>\\\n        </nameEntries>\\\n    </certificateConfig>\\\n    <TAKServerCAConfig keystore=\"JKS\" keystoreFile=\"certs/files/intermediate-signing.jks\" keystorePass=\"{self.certificate_password}\" validityDays=\"30\" signatureAlg=\"SHA256WithRSA\"/>\\\n</certificateSigning>\\\n<security>\\\n    <tls keystore=\"JKS\" keystoreFile=\"certs/files/takserver.jks\" keystorePass=\"{self.certificate_password}\" truststore=\"JKS\" truststoreFile=\"certs/files/truststore-intermediate.jks\" truststorePass=\"{self.certificate_password}\" context=\"TLSv1.2\" keymanager=\"SunX509\"/>\\\n</security>' {core_config_path}"

        self.run_command.run_command_no_output(sed_command, shell=True)
        self.run_command.emit_log_output("CoreConfig.example.xml modified successfully.", 'takserver-installer')

        # Format XML using xmllint
        self.run_command.emit_log_output("Now formatting CoreConfig.example.xml...", 'takserver-installer')
        xmllint_command = f"xmllint --format {core_config_path} -o {core_config_path}"
        self.run_command.run_command_no_output(xmllint_command, shell=True)
        self.run_command.emit_log_output("CoreConfig.example.xml formatted successfully.", 'takserver-installer')

    def create_env_file(self):
        """Create the .env file with necessary environment variables."""
        env_file_path = os.path.join(self.working_dir, self.extracted_folder_name, ".env")
        
        # Use TAK_SERVER_INSTALL_DIR for paths that will be used by TAK Server's docker-compose
        tak_install_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
        tak_dir = os.path.join(tak_install_dir, 'takserver-docker', self.extracted_folder_name, "tak")
        plugins_dir = os.path.join(tak_install_dir, 'takserver-docker', self.extracted_folder_name, "plugins")
        
        env_content = f"""# TAK Server environment configuration
TAK_DIR={tak_dir}
PLUGINS_DIR={plugins_dir}
"""
        with open(env_file_path, "w") as file:
            file.write(env_content)
        self.run_command.emit_log_output(f"Created .env file at {env_file_path}.", 'takserver-installer')
        self.completed_steps.append('create_env_file')

    def create_docker_compose_file(self):
        """Create the Docker Compose file for the TAK server."""
        docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
        docker_compose_content = f"""version: '3.8'

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
      - ${{TAK_DIR}}:/opt/tak:z
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
      - ${{TAK_DIR}}:/opt/tak:z
      - ${{PLUGINS_DIR}}:/opt/tak/webcontent:z

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
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        
        # Create .env file first
        self.create_env_file()
        
        # Clean up existing containers and images
        self.run_command.emit_log_output("Cleaning up existing Docker resources...", 'takserver-installer')
        
        # Use docker-compose down to stop and remove everything
        self.run_command.run_command(
            ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
            working_dir=docker_compose_dir,
            namespace='takserver-installer'
        )
        
        # Clean any dangling resources
        self.run_command.run_command(
            ["docker", "system", "prune", "-f"],
            working_dir=docker_compose_dir,
            namespace='takserver-installer'
        )
        
        # First build the images and wait for completion
        self.run_command.emit_log_output("Building Docker images (this may take several minutes)...", 'takserver-installer')
        build_result = self.run_command.run_command(
            ["docker-compose", "build", "--no-cache"],
            working_dir=docker_compose_dir,
            namespace='takserver-installer'
        )
        
        if build_result.returncode != 0:
            raise Exception("Docker image build failed")
            
        self.run_command.emit_log_output("Docker images built successfully.", 'takserver-installer')
        
        # Then start the containers
        self.run_command.emit_log_output("Starting Docker containers...", 'takserver-installer')
        up_result = self.run_command.run_command(
            ["docker-compose", "up", "-d"],
            working_dir=docker_compose_dir,
            namespace='takserver-installer'
        )
        
        if up_result.returncode != 0:
            raise Exception("Docker container startup failed")
            
        self.run_command.emit_log_output("Docker containers started, waiting for them to be ready...", 'takserver-installer')
        
        # Give containers initial time to start
        eventlet.sleep(10)
        
        # Wait for containers to be ready
        max_attempts = 30  # Maximum number of attempts (5 minutes total)
        attempt = 0
        containers_ready = False
        
        while attempt < max_attempts and not containers_ready:
            try:
                # Check if build is still in progress
                build_ps = self.run_command.run_command(
                    ["docker", "ps", "--filter", "status=running", "--format", "{{.Status}}"],
                    working_dir=docker_compose_dir,
                    namespace='takserver-installer',
                    capture_output=True
                )
                
                if "Up" in build_ps.stdout and not any(x in build_ps.stdout.lower() for x in ["exited", "restarting", "created"]):
                    containers_ready = True
                    self.run_command.emit_log_output("Containers are now running.", 'takserver-installer')
                    self.completed_steps.append('start_docker_compose')
                    break
                
                attempt += 1
                self.run_command.emit_log_output(f"Waiting for containers to be ready... (Attempt {attempt}/{max_attempts})", 'takserver-installer')
                eventlet.sleep(10)
                
            except Exception as e:
                self.run_command.emit_log_output(f"Error checking container status: {str(e)}", 'takserver-installer')
                attempt += 1
                eventlet.sleep(10)
        
        if not containers_ready:
            raise Exception("Timeout waiting for containers to be ready")

    def verify_containers(self):
        """Verify that the containers are running."""
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command_no_output(["docker-compose", "ps"], working_dir=docker_compose_dir)
        self.run_command.emit_log_output("TAKServer containers started.", 'takserver-installer')

    def restart_takserver(self):
        """Restart TAKServer and TAKServer database."""
        self.run_command.emit_log_output("Restarting TAKServer and TAKServer database...", 'takserver-installer')
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command_no_output(
            ["docker-compose", "restart"],
            working_dir=docker_compose_dir
        )
        # No need to add to completed_steps since we are not rolling back restarts

    def rollback_takserver_installation(self):
        """Rollback TAK Server installation if something goes wrong."""
        try:
            self.update_progress(25, "Cleaning up Docker containers and images")
            
            # Docker cleanup
            docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
            if os.path.exists(docker_compose_path):
                docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
                self.run_command.run_command(
                    ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                    working_dir=docker_compose_dir,
                    namespace='takserver-installer'
                )

            self.update_progress(45, "Cleaning up BuildKit resources")
            # Clean BuildKit resources
            buildkit_containers = [container_id for container_id in self.run_command.run_command(
                ["docker", "ps", "-a", "--filter", "ancestor=moby/buildkit:buildx-stable-1", "--format", "{{.ID}}"],
                namespace='takserver-installer',
                capture_output=True
            ).stdout.strip().split('\n') if container_id]

            if buildkit_containers:
                self.run_command.run_command(
                    ["docker", "rm", "-f"] + buildkit_containers,
                    namespace='takserver-installer'
                )

            self.update_progress(65, "Cleaning up BuildKit volumes")
            # Clean BuildKit volumes
            buildkit_volumes = [volume_id for volume_id in self.run_command.run_command(
                ["docker", "volume", "ls", "--filter", "name=buildkit", "--quiet"],
                namespace='takserver-installer',
                capture_output=True
            ).stdout.strip().split('\n') if volume_id]

            if buildkit_volumes:
                self.run_command.run_command(
                    ["docker", "volume", "rm", "-f"] + buildkit_volumes,
                    namespace='takserver-installer'
                )

            self.update_progress(85, "Removing BuildKit image")
            self.run_command.run_command(
                ["docker", "rmi", "-f", "moby/buildkit:buildx-stable-1"],
                namespace='takserver-installer'
            )

            self.update_progress(95, "Removing installation files")
            # Remove working directory
            if os.path.exists(self.working_dir):
                shutil.rmtree(self.working_dir)

            self.update_progress(100, "Rollback complete")
            return True

        except Exception as e:
            self.installation_progress = 0
            self.run_command.emit_log_output(f"Rollback error: {str(e)}", 'takserver-installer')
            raise

    def update_progress(self, progress, message):
        """Update installation progress"""
        self.installation_progress = progress
        self.run_command.emit_log_output(message, 'takserver-installer')

    def get_progress(self):
        """Get current installation progress"""
        return {
            'progress': self.installation_progress,
            'status': 'in_progress' if self.installation_progress < 100 else 'complete'
        }

    def main(self):
        try:
            # Initial setup (0-30%)
            self.update_progress(5, "Creating working directory")
            if 'create_working_directory' not in self.completed_steps:
                self.create_working_directory()

            self.update_progress(10, "Extracting TAK Server files")
            if 'unzip_docker_release' not in self.completed_steps:
                self.unzip_docker_release()

            # Configuration phase (30-50%)
            self.update_progress(35, "Updating core configuration")
            if 'update_coreconfig_password' not in self.completed_steps:
                self.update_coreconfig_password()

            self.update_progress(40, "Modifying core configuration")
            if 'modify_coreconfig' not in self.completed_steps:
                self.modify_coreconfig_with_sed_on_host()

            self.update_progress(45, "Finalizing core configuration")
            if 'copy_coreconfig' not in self.completed_steps:
                self.copy_coreconfig()

            self.update_progress(50, "Creating Docker compose configuration")
            if 'create_docker_compose_file' not in self.completed_steps:
                self.create_docker_compose_file()

            # Container deployment phase (50-75%)
            self.update_progress(55, "Building and starting Docker containers")
            self.start_docker_compose()

            if 'start_docker_compose' in self.completed_steps:
                self.update_progress(70, "Verifying container status")
                self.verify_containers()
                self.update_progress(75, "Containers running successfully")

                # Certificate configuration phase (75-100%)
                self.update_progress(85, "Configuring certificates")
                takserver_name = f"takserver-{self.takserver_version}"
                self.cert_config.configure_cert_metadata(takserver_name)

                self.update_progress(90, "Generating certificates")
                self.cert_config.certificate_generation(takserver_name)

                self.update_progress(95, "Restarting TAK Server")
                self.restart_takserver()

                self.update_progress(97, "Configuring certificates")
                self.cert_config.run_certmod(takserver_name)

                self.update_progress(98, "Copying client certificate to webaccess")
                self.cert_config.copy_client_cert_to_webaccess(takserver_name)

                self.update_progress(100, "Installation complete")
                return True
            else:
                raise Exception("Container deployment failed")

        except Exception as e:
            self.installation_progress = 0
            self.run_command.emit_log_output(str(e), 'takserver-installer')
            raise


