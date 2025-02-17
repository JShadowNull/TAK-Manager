# backend/services/scripts/takserver/takserver_installer.py

import os
import shutil
from backend.services.helpers.run_command import RunCommand
import re
from backend.services.scripts.docker.docker_manager import DockerManager
from backend.services.scripts.takserver.certconfig import CertConfig
from pathlib import Path
import time
import threading
from typing import Dict, Any, Optional, Callable
import asyncio
import docker
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from backend.services.helpers.directories import DirectoryHelper

# Load environment variables from .env file
load_dotenv()

class TakServerInstaller:
    def __init__(
        self,
        docker_zip_path: str,
        postgres_password: str,
        certificate_password: str,
        organization: str,
        state: str,
        city: str,
        organizational_unit: str,
        name: str,
        emit_event: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.run_command = RunCommand()
        self.docker_manager = DockerManager()
        self.docker_client = docker.from_env()
        self.directory_helper = DirectoryHelper()
        self.working_dir = self.directory_helper.get_default_working_directory()
        self.docker_zip_path = docker_zip_path
        self.postgres_password = postgres_password
        self.certificate_password = certificate_password
        self.organization = organization
        self.state = state
        self.city = city
        self.organizational_unit = organizational_unit
        self.name = name
        self.extracted_folder_name = None
        self.takserver_version = None
        self.emit_event = emit_event
        self._last_status = None
        
        self.cert_config = CertConfig(
            certificate_password=self.certificate_password,
            organization=self.organization,
            state=self.state,
            city=self.city,
            organizational_unit=self.organizational_unit,
            name=self.name,
            tak_dir=None,
            emit_event=self.emit_event
        )

    async def update_status(self, status: str, progress: float, message: str, error: Optional[str] = None) -> None:
        """Update installation status."""
        if self.emit_event:
            # Send terminal message
            await self.emit_event({
                "type": "terminal",
                "message": message,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })
            
            # Send progress update
            await self.emit_event({
                "type": "status",
                "status": status,
                "progress": progress,
                "error": error,
                "isError": error is not None,
                "timestamp": int(time.time() * 1000)
            })

    async def create_working_directory(self) -> None:
        """Create the working directory."""
        try:
            self.directory_helper.ensure_clean_directory(self.working_dir)
            self.cert_config.update_working_dir(self.working_dir)
        except Exception as e:
            raise Exception(f"Error creating working directory: {str(e)}")

    async def unzip_docker_release(self) -> None:
        """Extract the TAK Server Docker release."""
        try:
            if not os.path.exists(self.docker_zip_path):
                raise FileNotFoundError(f"ZIP file not found at {self.docker_zip_path}")

            # Prepare temp directory
            temp_extract_dir = self.directory_helper.get_temp_extract_directory()
            self.directory_helper.ensure_clean_directory(temp_extract_dir)

            # Extract to temp directory
            unzip_command = f"unzip {self.docker_zip_path} -d {temp_extract_dir}"
            result = await self.run_command.run_command_async(
                unzip_command,
                'install',
                emit_event=self.emit_event,
                shell=True
            )
            if not result.success:
                raise Exception(result.stderr)

            # Find the tak directory in the extracted contents
            extracted_contents = os.listdir(temp_extract_dir)
            if not extracted_contents:
                raise ValueError("Zip file appears to be empty")

            # Get the first directory
            temp_extracted_folder = os.path.join(temp_extract_dir, extracted_contents[0])
            
            # If it's a directory and contains a nested directory with same name (ignoring case)
            if os.path.isdir(temp_extracted_folder):
                inner_contents = os.listdir(temp_extracted_folder)
                if len(inner_contents) == 1 and inner_contents[0].lower().startswith('takserver-docker'):
                    # Move all contents from nested directory up one level
                    inner_dir = os.path.join(temp_extracted_folder, inner_contents[0])
                    for item in os.listdir(inner_dir):
                        src = os.path.join(inner_dir, item)
                        dst = os.path.join(temp_extracted_folder, item)
                        shutil.move(src, dst)
                    os.rmdir(inner_dir)  # Remove empty nested directory

            # Verify tak directory exists
            if not os.path.exists(os.path.join(temp_extracted_folder, "tak")):
                raise ValueError(f"TAK directory not found in extracted contents")

            # Get version from the extracted files
            version_file = os.path.join(temp_extracted_folder, "tak", "version.txt")
            if not os.path.exists(version_file):
                raise ValueError(f"Version file not found at {version_file}")
            
            with open(version_file, "r") as f:
                version = f.read().strip().lower()
                if not version:
                    raise ValueError("Version file is empty")
                self.takserver_version = version

            # Write version to working directory first
            version_file_path = self.directory_helper.get_version_file_path()
            with open(version_file_path, "w") as version_file:
                version_file.write(f"{self.takserver_version}\n")

            # Create the standardized folder name and paths
            self.extracted_folder_name = f"takserver-docker-{self.takserver_version}"
            final_path = os.path.join(self.working_dir, self.extracted_folder_name)

            # Ensure clean target directory
            self.directory_helper.ensure_clean_directory(final_path)

            # Move the contents to the final location
            for item in os.listdir(temp_extracted_folder):
                src = os.path.join(temp_extracted_folder, item)
                dst = os.path.join(final_path, item)
                shutil.move(src, dst)

            # Set the final tak_dir path
            self.tak_dir = os.path.join(final_path, "tak")
            self.cert_config.update_tak_dir(self.tak_dir)
            
        except Exception as e:
            self.directory_helper.cleanup_temp_directory()
            raise Exception(f"Error during ZIP extraction: {str(e)}")
        finally:
            self.directory_helper.cleanup_temp_directory()

    async def copy_coreconfig(self) -> None:
        """Copy CoreConfig.xml from example."""
        try:
            core_config_path, example_core_config = self.directory_helper.get_core_config_paths(self.tak_dir)

            if not os.path.exists(core_config_path):
                if os.path.exists(example_core_config):
                    shutil.copy(example_core_config, core_config_path)
                else:
                    raise FileNotFoundError(f"Example CoreConfig file not found at {example_core_config}")
                
        except Exception as e:
            raise Exception(f"Error setting up CoreConfig.xml: {str(e)}")

    async def update_coreconfig_password(self) -> None:
        """Update database password in CoreConfig.xml."""
        try:
            core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")

            if os.path.exists(core_config_path):
                # Parse XML with namespaces
                ET.register_namespace('', "http://bbn.com/marti/xml/config")
                ET.register_namespace('xsi', "http://www.w3.org/2001/XMLSchema-instance")
                tree = ET.parse(core_config_path)
                root = tree.getroot()

                # Define namespace map
                ns = {'ns': "http://bbn.com/marti/xml/config"}

                # Find and update repository connection password using namespace
                repository = root.find(".//ns:repository", namespaces=ns)
                if repository is not None:
                    connection = repository.find("ns:connection", namespaces=ns)
                    if connection is not None:
                        connection.set('password', self.postgres_password)
                    else:
                        raise Exception("Repository connection element not found")
                else:
                    raise Exception("Repository element not found")

                # Write back to file
                tree.write(core_config_path, encoding='UTF-8', xml_declaration=True)

                # Format XML using xmllint
                format_result = await self.run_command.run_command_async(
                    f"xmllint --format {core_config_path} -o {core_config_path}",
                    'install',
                    emit_event=self.emit_event,
                    shell=True
                )
                if not format_result.success:
                    raise Exception(format_result.stderr)
            else:
                raise FileNotFoundError(f"CoreConfig.xml not found at {core_config_path}")
                
        except Exception as e:
            raise Exception(f"Error updating CoreConfig password: {str(e)}")

    async def modify_coreconfig_with_sed_on_host(self) -> None:
        """Update database host and certificate config in CoreConfig.xml."""
        try:
            core_config_path = os.path.join(self.tak_dir, "CoreConfig.xml")
            if not os.path.exists(core_config_path):
                raise FileNotFoundError(f"CoreConfig.xml not found at {core_config_path}")

            # Parse XML
            ET.register_namespace('', "http://bbn.com/marti/xml/config")
            ET.register_namespace('xsi', "http://www.w3.org/2001/XMLSchema-instance")
            tree = ET.parse(core_config_path)
            root = tree.getroot()

            # Update database host
            for conn in root.findall(".//connection"):
                url = conn.get('url', '')
                if 'jdbc:postgresql://' in url:
                    new_url = url.replace('localhost', 'tak-database')
                    conn.set('url', new_url)

            # Create certificate signing element
            cert_signing = ET.Element('certificateSigning')
            cert_signing.set('CA', 'TAKServer')

            cert_config = ET.SubElement(cert_signing, 'certificateConfig')
            name_entries = ET.SubElement(cert_config, 'nameEntries')
            
            org_entry = ET.SubElement(name_entries, 'nameEntry')
            org_entry.set('name', 'O')
            org_entry.set('value', 'TAK')
            
            ou_entry = ET.SubElement(name_entries, 'nameEntry')
            ou_entry.set('name', 'OU')
            ou_entry.set('value', 'TAK')

            ca_config = ET.SubElement(cert_signing, 'TAKServerCAConfig')
            ca_config.set('keystore', 'JKS')
            ca_config.set('keystoreFile', 'certs/files/intermediate-signing.jks')
            ca_config.set('keystorePass', self.certificate_password)
            ca_config.set('validityDays', '30')
            ca_config.set('signatureAlg', 'SHA256WithRSA')

            # Create security element
            security = ET.Element('security')
            tls = ET.SubElement(security, 'tls')
            tls.set('keystore', 'JKS')
            tls.set('keystoreFile', 'certs/files/takserver.jks')
            tls.set('keystorePass', self.certificate_password)
            tls.set('truststore', 'JKS')
            tls.set('truststoreFile', 'certs/files/truststore-intermediate.jks')
            tls.set('truststorePass', self.certificate_password)
            tls.set('context', 'TLSv1.2')
            tls.set('keymanager', 'SunX509')

            # Remove existing security section and add new ones
            for old_security in root.findall('.//security'):
                root.remove(old_security)
            root.append(cert_signing)
            root.append(security)

            # Write back to file
            tree.write(core_config_path, encoding='UTF-8', xml_declaration=True)

            # Format XML using xmllint
            format_result = await self.run_command.run_command_async(
                f"xmllint --format {core_config_path} -o {core_config_path}",
                'install',
                emit_event=self.emit_event,
                shell=True
            )
            if not format_result.success:
                raise Exception(format_result.stderr)
            
        except Exception as e:
            raise Exception(f"Error modifying CoreConfig.xml: {str(e)}")

    async def create_env_file(self) -> None:
        """Create Docker Compose .env file."""
        try:
            env_path = os.path.join(self.working_dir, self.extracted_folder_name, ".env")
            
            # Get base directory from environment, with fallback
            host_base_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
            if not host_base_dir:
                raise ValueError("TAK_SERVER_INSTALL_DIR environment variable is not set")
                
            host_tak_dir = os.path.join(host_base_dir, 'tak-manager', 'data', 'takserver', self.extracted_folder_name, "tak")
            host_plugins_dir = os.path.join(host_tak_dir, "webcontent")
            
            env_content = f"""TAK_DIR={host_tak_dir}
PLUGINS_DIR={host_plugins_dir}
"""
            with open(env_path, "w") as file:
                file.write(env_content)
                
        except Exception as e:
            raise Exception(f"Error creating .env file: {str(e)}")

    async def create_docker_compose_file(self) -> None:
        """Create Docker Compose file."""
        try:
            docker_compose_path = os.path.join(self.working_dir, self.extracted_folder_name, "docker-compose.yml")
            
            host_base_dir = os.getenv('TAK_SERVER_INSTALL_DIR')
            host_tak_dir = os.path.join(host_base_dir, 'tak-manager', 'data', 'takserver', self.extracted_folder_name, "tak")
            host_plugins_dir = os.path.join(host_tak_dir, "webcontent")
            
            # Convert paths to Docker format by detecting Windows-style paths
            def convert_path_for_docker(path):
                # Convert to forward slashes for consistency
                path = path.replace('\\', '/')
                
                # Detect Windows path by checking for drive letter pattern (e.g., C:/)
                if re.match(r'^[A-Za-z]:', path):
                    # Convert Windows drive letter (e.g., C:) to Docker format (/c)
                    drive, rest = path.split(':', 1)
                    path = f'/{drive.lower()}{rest}'
                return path
            
            host_tak_dir = convert_path_for_docker(host_tak_dir)
            host_plugins_dir = convert_path_for_docker(host_plugins_dir)
            
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
      - type: bind
        source: {host_tak_dir}
        target: /opt/tak
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
      - type: bind
        source: {host_tak_dir}
        target: /opt/tak
      - type: bind
        source: {host_plugins_dir}
        target: /opt/tak/webcontent

networks:
  net:
    name: 'takserver'
    ipam:
      driver: default
      config:
        - subnet: 172.16.16.0/24

volumes:
  db-data:
"""
            with open(docker_compose_path, "w") as file:
                file.write(docker_compose_content)
            
        except Exception as e:
            raise Exception(f"Error creating docker-compose.yml: {str(e)}")

    async def start_docker_compose(self) -> None:
        """Start Docker Compose services."""
        try:
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            await self.create_env_file()

            # Clean up existing containers and images
            result = await self.run_command.run_command_async(
                ["docker-compose", "down", "--rmi", "all", "--volumes", "--remove-orphans"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            
            result = await self.run_command.run_command_async(
                ["docker", "system", "prune", "-f"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )

            # Build images
            build_result = await self.run_command.run_command_async(
                ["docker-compose", "build"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if not build_result.success:
                raise Exception(build_result.stderr)

            # Start containers
            up_result = await self.run_command.run_command_async(
                ["docker-compose", "up", "-d"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if not up_result.success:
                raise Exception(up_result.stderr)

            # Wait for containers to be ready
            max_attempts = 30
            attempt = 0
            containers_ready = False
            
            while attempt < max_attempts and not containers_ready:
                try:
                    # Get container status using Docker SDK
                    db_container = self.docker_client.containers.get(f"tak-database-{self.takserver_version}")
                    server_container = self.docker_client.containers.get(f"takserver-{self.takserver_version}")
                    
                    if db_container.status == "running" and server_container.status == "running":
                        containers_ready = True
                        break
                except docker.errors.NotFound:
                    # Container not found yet, continue waiting
                    pass
                except Exception as e:
                    # Log other errors but continue waiting
                    if self.emit_event:
                        await self.emit_event({
                            "type": "terminal",
                            "message": f"Container check error: {str(e)}",
                            "isError": False
                        })
                
                attempt += 1
                await asyncio.sleep(1)
            
            if not containers_ready:
                raise Exception("Timeout waiting for containers to be ready")

        except Exception as e:
            raise Exception(f"Error starting Docker containers: {str(e)}")

    async def verify_containers(self) -> None:
        """Verify containers are running."""
        try:
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker-compose", "ps"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir
            )
            if not result.success:
                raise Exception(result)
            
        except Exception as e:
            raise Exception(f"Error verifying containers: {str(e)}")

    async def restart_takserver(self) -> None:
        """Restart TAK Server containers."""
        try:
            docker_compose_dir = self.directory_helper.get_docker_compose_directory()
            result = await self.run_command.run_command_async(
                ["docker-compose", "restart"],
                'install',
                emit_event=self.emit_event,
                working_dir=docker_compose_dir,
                ignore_errors=True
            )
            if not result.success:
                raise Exception(result.error_message)
            
        except Exception as e:
            raise Exception(f"Error restarting TAK Server: {str(e)}")

    async def main(self) -> bool:
        """Main installation method."""
        try:
            # Define task weights and initial progress
            weights = {
                'setup': 5,
                'config': 10,
                'docker_build': 50,
                'docker_start': 15,
                'cert_config': 20
            }
            progress = 0
            
            # Initial setup (0-5%)
            await self.update_status("in_progress", progress, "Preparing TAK Server installation environment...")
            await self.create_working_directory()
            progress += weights['setup'] * 0.3
            await self.update_status("in_progress", progress, "Working directory created successfully")
            await self.unzip_docker_release()
            progress += weights['setup'] * 0.7
            await self.update_status("in_progress", progress, "TAK Server files extracted and validated")

            # Configuration (5-15%)
            await self.copy_coreconfig()
            progress += weights['config'] * 0.25
            await self.update_status("in_progress", progress, "Core configuration files initialized")
            await self.update_coreconfig_password()
            progress += weights['config'] * 0.25
            await self.update_status("in_progress", progress, "Database credentials configured")
            await self.modify_coreconfig_with_sed_on_host()
            progress += weights['config'] * 0.25
            await self.update_status("in_progress", progress, "Server configuration updated with database settings")
            await self.create_docker_compose_file()
            progress += weights['config'] * 0.25
            await self.update_status("in_progress", progress, "Docker environment configured successfully")

            # Docker build and deployment (15-80%)
            await self.update_status("in_progress", progress, "Initializing Docker container setup...")
            
            build_start_progress = progress
            build_weight = weights['docker_build']
            
            # Send build message once before starting docker compose
            await self.emit_event({
                "type": "terminal",
                "message": "Building TAK Server containers... This may take a few minutes",
                "isError": False,
                "timestamp": int(time.time() * 1000)
            })

            async def update_build_progress():
                build_progress = 0
                while build_progress < build_weight:
                    await asyncio.sleep(2)
                    build_progress = min(build_progress + 1, build_weight * 0.95)
                    total_progress = build_start_progress + build_progress
                    
                    # Only send status update without terminal message
                    await self.emit_event({
                        "type": "status",
                        "status": "in_progress",
                        "progress": total_progress,
                        "error": None,
                        "isError": False,
                        "timestamp": int(time.time() * 1000)
                    })
            
            progress_task = asyncio.create_task(update_build_progress())
            
            await self.start_docker_compose()
            
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass
            
            progress = build_start_progress + weights['docker_build']
            await self.update_status("in_progress", progress, "Docker containers deployed successfully")
            
            await self.verify_containers()
            progress += weights['docker_start']
            await self.update_status("in_progress", progress, "Container health check passed")

            # Certificate configuration (80-100%)
            await self.update_status("in_progress", progress, "Setting up secure communication certificates...")
            takserver_name = f"takserver-{self.takserver_version}"
            await self.cert_config.configure_cert_metadata(takserver_name)
            progress += weights['cert_config'] * 0.25
            await self.update_status("in_progress", progress, "Certificate metadata configured successfully")
            await self.cert_config.certificate_generation(takserver_name)
            progress += weights['cert_config'] * 0.25
            await self.update_status("in_progress", progress, "Security certificates generated")
            await self.restart_takserver()
            progress += weights['cert_config'] * 0.25
            await self.update_status("in_progress", progress, "TAK Server restarted with new certificates")
            await self.cert_config.run_certmod(takserver_name)
            await self.cert_config.copy_client_cert_to_webaccess(takserver_name)
            progress = 100
            await self.update_status("complete", progress, "TAK Server installation completed successfully")
            return True

        except Exception as e:
            error_message = f"Installation failed: {str(e)}"
            await self.update_status("error", 100, "Installation encountered an error", error_message)
            return False


