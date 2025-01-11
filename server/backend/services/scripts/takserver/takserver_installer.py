# backend/services/scripts/takserver/takserver_installer.py

import os
import shutil
from backend.services.helpers.run_command import RunCommand
import re
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.takserver.certconfig import CertConfig
from pathlib import Path
from flask_sse import sse
from backend.config.logging_config import configure_logging
import time

# Configure logging using centralized config
logger = configure_logging(__name__)

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
        self._stop_requested = False
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

    def create_working_directory(self, event_type: str = 'takserver-install'):
        """Create the working directory, removing it first if it exists."""
        if os.path.exists(self.working_dir):
            try:
                message = f"Removing existing directory: {self.working_dir}"
                self.emit_terminal_output(message)
                sse.publish(
                    {
                        'message': message,
                        'isError': False
                    },
                    type=event_type
                )
                shutil.rmtree(self.working_dir)
                message = "Successfully removed existing directory"
                self.emit_terminal_output(message)
                sse.publish(
                    {
                        'message': message,
                        'isError': False
                    },
                    type=event_type
                )
            except Exception as e:
                # Just propagate the error
                raise

        try:
            os.makedirs(self.working_dir)
            message = f"Created directory: {self.working_dir}"
            self.emit_terminal_output(message)
            sse.publish(
                {
                    'message': message,
                    'isError': False
                },
                type=event_type
            )
            self.cert_config.update_working_dir(self.working_dir)  # Update working_dir in cert_config
            self.completed_steps.append('create_working_directory')
        except Exception as e:
            # Just propagate the error
            raise

    def unzip_docker_release(self, event_type: str = 'takserver-install'):
        if not os.path.exists(self.docker_zip_path):
            message = f"{self.docker_zip_path} not found. Ensure the file is in the specified location."
            self.emit_terminal_output(message, is_error=True)
            raise FileNotFoundError(message)

        zip_filename = os.path.basename(self.docker_zip_path)
        match = re.search(r'takserver-docker-(.+)\.zip', zip_filename)
        if not match:
            message = "Failed to extract version from the zip filename."
            self.emit_terminal_output(message, is_error=True)
            raise ValueError(message)

        self.takserver_version = match.group(1).lower()
        message = f"TAKServer version: {self.takserver_version}"
        self.emit_terminal_output(message)
        sse.publish(
            {
                'message': message,
                'isError': False
            },
            type=event_type
        )

        self.zip_filename = zip_filename

        # Extract directly to working directory
        result = self.run_command.run_command(
            ["unzip", self.docker_zip_path, "-d", self.working_dir],
            event_type='takserver-terminal',  # Use terminal event type for command output
            emit_output=True
        )
        if not result.success:
            self.emit_terminal_output(result.error_message, is_error=True)
            raise Exception(result.error_message)

        message = f"Unzipped {self.docker_zip_path} to {self.working_dir}"
        self.emit_terminal_output(message)

        # Set paths after extraction
        self.extracted_folder_name = zip_filename.replace(".zip", "")
        self.tak_dir = os.path.join(self.working_dir, self.extracted_folder_name, "tak")

        if not os.path.exists(self.tak_dir):
            message = f"TAK directory not found at expected path: {self.tak_dir}"
            self.emit_terminal_output(message, is_error=True)
            raise ValueError(message)

        message = f"TAK directory set to: {self.tak_dir}"
        self.emit_terminal_output(message)
        self.completed_steps.append('unzip_docker_release')
        self.cert_config.update_tak_dir(self.tak_dir)

        version_file_path = os.path.join(self.working_dir, "version.txt")
        with open(version_file_path, "w") as version_file:
            version_file.write(f"{self.takserver_version}\n")
        message = f"Created version.txt with version {self.takserver_version} in {self.working_dir}"
        self.emit_terminal_output(message)

    def copy_coreconfig(self, event_type: str = 'takserver-install'):
        """Copy CoreConfig.xml from the example file."""
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")
        example_core_config = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if not os.path.exists(core_config_path):
            if os.path.exists(example_core_config):
                shutil.copy(example_core_config, core_config_path)
                sse.publish(
                    {
                        'message': "Copied CoreConfig.example.xml to CoreConfig.xml",
                        'isError': False
                    },
                    type=event_type
                )
                self.completed_steps.append('copy_coreconfig')
            else:
                sse.publish(
                    {
                        'message': f"Error: Example CoreConfig file not found at {example_core_config}.",
                        'isError': True
                    },
                    type=event_type
                )
        else:
            sse.publish(
                {
                    'message': "CoreConfig.xml already exists.",
                    'isError': False
                },
                type=event_type
            )

    def update_coreconfig_password(self, event_type: str = 'takserver-install'):
        """Update the database password in CoreConfig.xml."""
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if os.path.exists(core_config_path):
            sse.publish(
                {
                    'message': "Updating database password in CoreConfig.example.xml...",
                    'isError': False
                },
                type=event_type
            )
            
            # Use sed command in container environment
            sed_command = f"sed -i 's|password=\"[^\"]*\"|password=\"{self.postgres_password}\"|g' \"{core_config_path}\""
            self.run_command.run_command(
                sed_command,
                event_type=event_type,
                shell=True,
                emit_output=False
            )
            
            sse.publish(
                {
                    'message': "Updated CoreConfig.xml password.",
                    'isError': False
                },
                type=event_type
            )
            self.completed_steps.append('update_coreconfig_password')
        else:
            sse.publish(
                {
                    'message': f"CoreConfig.xml not found at {core_config_path}.",
                    'isError': True
                },
                type=event_type
            )

    def modify_coreconfig_with_sed_on_host(self, event_type: str = 'takserver-install'):
        core_config_path = os.path.join(self.tak_dir, "CoreConfig.example.xml")

        if not os.path.exists(core_config_path):
            sse.publish(
                {
                    'message': f"CoreConfig.example.xml not found at {core_config_path}.",
                    'isError': True
                },
                type=event_type
            )
            return

        sse.publish(
            {
                'message': "Modifying CoreConfig.example.xml for certificate enrollment...",
                'isError': False
            },
            type=event_type
        )

        # Simplified sed command for container environment
        sed_command = f"sed -i '/<security>/,/<\\/security>/c \\\n<certificateSigning CA=\"TAKServer\">\\\n    <certificateConfig>\\\n        <nameEntries>\\\n            <nameEntry name=\"O\" value=\"TAK\"/>\\\n            <nameEntry name=\"OU\" value=\"TAK\"/>\\\n        </nameEntries>\\\n    </certificateConfig>\\\n    <TAKServerCAConfig keystore=\"JKS\" keystoreFile=\"certs/files/intermediate-signing.jks\" keystorePass=\"{self.certificate_password}\" validityDays=\"30\" signatureAlg=\"SHA256WithRSA\"/>\\\n</certificateSigning>\\\n<security>\\\n    <tls keystore=\"JKS\" keystoreFile=\"certs/files/takserver.jks\" keystorePass=\"{self.certificate_password}\" truststore=\"JKS\" truststoreFile=\"certs/files/truststore-intermediate.jks\" truststorePass=\"{self.certificate_password}\" context=\"TLSv1.2\" keymanager=\"SunX509\"/>\\\n</security>' {core_config_path}"

        self.run_command.run_command(
            sed_command,
            event_type=event_type,
            shell=True,
            emit_output=False
        )
        sse.publish(
            {
                'message': "CoreConfig.example.xml modified successfully.",
                'isError': False
            },
            type=event_type
        )

        # Format XML using xmllint
        sse.publish(
            {
                'message': "Now formatting CoreConfig.example.xml...",
                'isError': False
            },
            type=event_type
        )
        xmllint_command = f"xmllint --format {core_config_path} -o {core_config_path}"
        self.run_command.run_command(
            xmllint_command,
            event_type=event_type,
            shell=True,
            emit_output=False
        )
        sse.publish(
            {
                'message': "CoreConfig.example.xml formatted successfully.",
                'isError': False
            },
            type=event_type
        )

    def create_env_file(self, event_type: str = 'takserver-install'):
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
        sse.publish(
            {
                'message': f"Created .env file at {env_file_path}.",
                'isError': False
            },
            type=event_type
        )
        self.completed_steps.append('create_env_file')

    def create_docker_compose_file(self, event_type: str = 'takserver-install'):
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
        sse.publish(
            {
                'message': f"Created docker-compose.yml file at {docker_compose_path}.",
                'isError': False
            },
            type=event_type
        )
        self.completed_steps.append('create_docker_compose_file')

    def start_docker_compose(self, event_type: str = 'takserver-install'):
        """Start Docker Compose services."""
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        
        # Create .env file first
        self.create_env_file()
        
        # Clean up existing containers and images
        message = "Cleaning up existing Docker resources..."
        self.emit_terminal_output(message)
        
        # Use docker-compose down to stop and remove everything
        result = self.run_command.run_command(
            ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
            event_type='takserver-terminal',
            working_dir=docker_compose_dir,
            emit_output=True
        )
        if not result.success:
            self.emit_terminal_output(result.error_message, is_error=True)
            raise Exception(result.error_message)
        
        # Clean any dangling resources
        result = self.run_command.run_command(
            ["docker", "system", "prune", "-f"],
            event_type='takserver-terminal',
            working_dir=docker_compose_dir,
            emit_output=True
        )
        if not result.success:
            self.emit_terminal_output(result.error_message, is_error=True)
            raise Exception(result.error_message)

        # First build the images and wait for completion
        message = "Building Docker images (this may take several minutes)..."
        self.emit_terminal_output(message)
        build_result = self.run_command.run_command(
            ["docker-compose", "build"],
            event_type='takserver-terminal',
            working_dir=docker_compose_dir,
            emit_output=True
        )
        if not build_result.success:
            self.emit_terminal_output(build_result.error_message, is_error=True)
            raise Exception(build_result.error_message)
            
        message = "Docker images built successfully."
        self.emit_terminal_output(message)

        # Then start the containers
        message = "Starting Docker containers..."
        self.emit_terminal_output(message)
        up_result = self.run_command.run_command(
            ["docker-compose", "up", "-d"],
            event_type='takserver-terminal',
            working_dir=docker_compose_dir,
            emit_output=True
        )
        if not up_result.success:
            self.emit_terminal_output(up_result.error_message, is_error=True)
            raise Exception(up_result.error_message)
            
        message = "Docker containers started, waiting for them to be ready..."
        self.emit_terminal_output(message)
        
        # Wait for containers to be ready
        max_attempts = 30  # Maximum number of attempts (5 minutes total)
        attempt = 0
        containers_ready = False
        
        while attempt < max_attempts and not containers_ready:
            # Check if build is still in progress
            build_ps = self.run_command.run_command(
                ["docker", "ps", "-a", "--filter", "status=running", "--format", "{{.Status}}"],
                event_type='takserver-terminal',
                working_dir=docker_compose_dir,
                capture_output=True
            )
            if not build_ps.success:
                self.emit_terminal_output(build_ps.error_message, is_error=True)
                raise Exception(build_ps.error_message)
            
            if "Up" in build_ps.stdout and not any(x in build_ps.stdout.lower() for x in ["exited", "restarting", "created"]):
                containers_ready = True
                message = "Containers are now running."
                self.emit_terminal_output(message)
                self.completed_steps.append('start_docker_compose')
                break
            
            attempt += 1
            message = f"Waiting for containers to be ready... (Attempt {attempt}/{max_attempts})"
            self.emit_terminal_output(message)
        
        if not containers_ready:
            message = "Timeout waiting for containers to be ready"
            self.emit_terminal_output(message, is_error=True)
            raise Exception(message)

    def verify_containers(self, event_type: str = 'takserver-install'):
        """Verify that the containers are running."""
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command(
            ["docker-compose", "ps"],
            event_type=event_type,
            working_dir=docker_compose_dir,
            emit_output=True
        )
        sse.publish(
            {
                'message': "TAKServer containers started.",
                'isError': False
            },
            type=event_type
        )

    def restart_takserver(self, event_type: str = 'takserver-install'):
        """Restart TAKServer and TAKServer database."""
        sse.publish(
            {
                'message': "Restarting TAKServer and TAKServer database...",
                'isError': False
            },
            type=event_type
        )
        docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
        self.run_command.run_command(
            ["docker-compose", "restart"],
            event_type=event_type,
            working_dir=docker_compose_dir,
            emit_output=True
        )

    def rollback_takserver_installation(self):
        """Rollback TAK Server installation if something goes wrong."""
        try:
            logger.debug("Starting TAK Server rollback")
            # Send initial progress message
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Starting TAK Server rollback',
                'progress': 0
            }, type='takserver-install')
            
            # Docker cleanup
            docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
            if os.path.exists(docker_compose_path):
                logger.debug(f"Found docker-compose.yml at {docker_compose_path}")
                docker_compose_dir = os.path.join(self.working_dir, self.extracted_folder_name)
                sse.publish({
                    'status': 'in_progress',
                    'operation': 'rollback',
                    'message': 'Cleaning up Docker containers and images',
                    'progress': 25
                }, type='takserver-install')
                logger.debug("Running docker-compose down with cleanup flags")
                self.run_command.run_command(
                    ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                    event_type='takserver-install',
                    working_dir=docker_compose_dir,
                    emit_output=True
                )

            # Clean BuildKit resources
            logger.debug("Starting BuildKit container cleanup")
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Cleaning up BuildKit resources',
                'progress': 50
            }, type='takserver-install')
            
            buildkit_containers = [container_id for container_id in self.run_command.run_command(
                ["docker", "ps", "-aq", "--filter", "name=buildkit"],
                event_type='takserver-install',
                capture_output=True
            ).stdout.strip().split('\n') if container_id]

            if buildkit_containers:
                logger.debug(f"Found BuildKit containers to remove: {buildkit_containers}")
                self.run_command.run_command(
                    ["docker", "rm", "-f"] + buildkit_containers,
                    event_type='takserver-install',
                    emit_output=True
                )

            # Clean BuildKit volumes
            logger.debug("Starting BuildKit volume cleanup")
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Cleaning up BuildKit volumes',
                'progress': 75
            }, type='takserver-install')
            
            buildkit_volumes = [volume_id for volume_id in self.run_command.run_command(
                ["docker", "volume", "ls", "-q", "--filter", "name=buildkit"],
                event_type='takserver-install',
                capture_output=True
            ).stdout.strip().split('\n') if volume_id]

            if buildkit_volumes:
                logger.debug(f"Found BuildKit volumes to remove: {buildkit_volumes}")
                self.run_command.run_command(
                    ["docker", "volume", "rm", "-f"] + buildkit_volumes,
                    event_type='takserver-install',
                    emit_output=True
                )

            # Remove working directory
            logger.debug(f"Removing working directory: {self.working_dir}")
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Removing installation files',
                'progress': 90
            }, type='takserver-install')
            
            if os.path.exists(self.working_dir):
                shutil.rmtree(self.working_dir)

            logger.debug("Rollback completed successfully")
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Rollback complete',
                'progress': 100
            }, type='takserver-install')
            return True

        except Exception as e:
            logger.error(f"Rollback failed with error: {str(e)}")
            sse.publish({
                'status': 'error',
                'operation': 'rollback',
                'message': f"Rollback error: {str(e)}",
                'error': str(e),
                'progress': 0
            }, type='takserver-install')
            raise

    def update_progress(self, progress, message, status='in_progress'):
        """Update installation progress"""
        logger.debug(f"Updating progress: {progress}%, Message: {message}, Status: {status}")
        self.installation_progress = progress
        # Send progress update
        sse.publish(
            {
                'status': status,
                'operation': 'install',
                'message': message,
                'progress': progress
            },
            type='takserver-install'
        )
        # Also send as terminal output
        self.emit_terminal_output(message, is_error=status == 'error')

    def emit_terminal_output(self, message, is_error=False):
        """Helper method to emit terminal output"""
        sse.publish(
            {
                'message': message,
                'isError': is_error,
                'timestamp': int(time.time() * 1000)  # milliseconds timestamp
            },
            type='takserver-terminal'
        )

    def stop_installation(self):
        """Stop the installation process and perform rollback"""
        logger.debug("Attempting to stop installation")
        try:
            # Set the stop flag
            logger.debug("Setting stop flag")
            self._stop_requested = True
            
            # Notify that we're starting rollback
            logger.debug("Publishing rollback start notification")
            sse.publish({
                'status': 'in_progress',
                'operation': 'rollback',
                'message': 'Stopping installation and starting rollback',
                'progress': 0
            }, type='takserver-install')
            
            # Reset progress immediately
            logger.debug("Resetting installation progress")
            self.installation_progress = 0
            
            # Perform rollback
            logger.debug("Starting rollback process")
            self.rollback_takserver_installation()
            
            logger.debug("Installation stopped successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to stop installation: {str(e)}")
            # Send error via SSE
            logger.debug("Publishing error notification")
            sse.publish({
                'status': 'error',
                'operation': 'rollback',
                'message': f"Failed to stop installation: {str(e)}",
                'error': str(e),
                'progress': 0
            }, type='takserver-install')
            raise

    def _check_stop_requested(self):
        """Check if stop was requested and raise exception if it was"""
        logger.debug("Checking if stop was requested")
        if self._stop_requested:
            logger.debug("Stop was requested, resetting progress and raising exception")
            # Just reset internal progress counter
            self.installation_progress = 0
            raise Exception("Installation stopped by user request")

    def main(self):
        """Main installation method."""
        try:
            # Send initial progress message
            self.update_progress(0, "Starting TAK Server installation")

            # Initial setup (0-30%)
            self._check_stop_requested()
            self.update_progress(5, "Creating working directory")
            if 'create_working_directory' not in self.completed_steps:
                self.create_working_directory()

            self._check_stop_requested()
            self.update_progress(10, "Extracting TAK Server files")
            if 'unzip_docker_release' not in self.completed_steps:
                self.unzip_docker_release()

            # Configuration phase (30-50%)
            self._check_stop_requested()
            self.update_progress(35, "Updating core configuration")
            if 'update_coreconfig_password' not in self.completed_steps:
                self.update_coreconfig_password()

            self._check_stop_requested()
            self.update_progress(40, "Modifying core configuration")
            if 'modify_coreconfig' not in self.completed_steps:
                self.modify_coreconfig_with_sed_on_host()

            self._check_stop_requested()
            self.update_progress(45, "Finalizing core configuration")
            if 'copy_coreconfig' not in self.completed_steps:
                self.copy_coreconfig()

            self._check_stop_requested()
            self.update_progress(50, "Creating Docker compose configuration")
            if 'create_docker_compose_file' not in self.completed_steps:
                self.create_docker_compose_file()

            # Container deployment phase (50-75%)
            self._check_stop_requested()
            self.update_progress(55, "Building and starting Docker containers")
            self.start_docker_compose()

            if 'start_docker_compose' in self.completed_steps:
                self._check_stop_requested()
                self.update_progress(70, "Verifying container status")
                self.verify_containers()
                self.update_progress(75, "Containers running successfully")

                # Certificate configuration phase (75-100%)
                self._check_stop_requested()
                self.update_progress(85, "Configuring certificates")
                takserver_name = f"takserver-{self.takserver_version}"
                self.cert_config.configure_cert_metadata(takserver_name)

                self._check_stop_requested()
                self.update_progress(90, "Generating certificates")
                self.cert_config.certificate_generation(takserver_name)

                self._check_stop_requested()
                self.update_progress(95, "Restarting TAK Server")
                self.restart_takserver()

                self._check_stop_requested()
                self.update_progress(97, "Configuring certificates")
                self.cert_config.run_certmod(takserver_name)

                self._check_stop_requested()
                self.update_progress(98, "Copying client certificate to webaccess")
                self.cert_config.copy_client_cert_to_webaccess(takserver_name)

                self.update_progress(100, "Installation complete", status='complete')
                return True
            else:
                # Send error via SSE instead of raising
                self.update_progress(100, "Container deployment failed", status='error')
                return False

        except Exception as e:
            # Send error status via SSE but don't raise
            sse.publish(
                {
                    'status': 'error',
                    'operation': 'install',
                    'message': str(e),
                    'error': str(e),
                    'progress': 100  # Set to 100 to enable the Next button
                },
                type='takserver-install'
            )
            return False


